import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeEntity,ItemStack,world,system,reset } from './mock-minecraft.mjs';
import { forms,responses } from './mock-forms.mjs';
import { sessions } from '../pack/BP/scripts/mycology/sessions.js';
import { MUSHROOMS } from '../pack/BP/scripts/mycology/registry.js';
import { CONFIG } from '../pack/BP/scripts/mycology/config.js';
import { receipt } from '../pack/BP/scripts/mycology/appraisal.js';
import { counts } from '../pack/BP/scripts/mycology/progress.js';
import { openAppraiser } from '../pack/BP/scripts/mycology/ui.js';
import { revealAppraisal,revealFrames,revealPreferences,cycleRevealMode,toggleRevealSound } from '../pack/BP/scripts/mycology/reveal.js';

function setup(){
 reset();sessions.clear();forms.length=0;responses.length=0;
 const p=new FakeEntity('reader');world.entities.set(p.id,p);
 const npc=new FakeEntity('npc',CONFIG.npcType,p.dimension);world.entities.set(npc.id,npc);
 const events=[];
 p.onScreenDisplay={setTitle:(title,options)=>events.push({kind:'title',title,options,tick:system.currentTick}),setActionBar:text=>events.push({kind:'bar',text})};
 p.playSound=(id,options)=>events.push({kind:'sound',id,options,tick:system.currentTick});
 sessions.set(p.id,{npcId:npc.id});
 return {p,npc,events};
}
async function drain(promise,onTick=()=>{}){
 let done=false,value,error;
 promise.then(x=>{done=true;value=x;},e=>{done=true;error=e;});
 for(let i=0;i<3000&&!done;i++){
  await Promise.resolve();
  if(system.timers.size){
   assert.equal(system.timers.size,1,'only one pending reveal timer');
   const [id,{f,ticks}]=system.timers.entries().next().value;
   system.timers.delete(id);system.currentTick+=ticks;onTick();f();
  }
 }
 assert(done,'reveal must always settle');if(error)throw error;
 assert.equal(system.timers.size,0,'no orphan sound or display timer');return value;
}
const top=MUSHROOMS.find(d=>d.rarity===10&&d.group==='red');
const batch={count:64,results:[{id:top.id,amount:63},{id:'R01',amount:1}],fresh:[top.id,'R01'],dropped:0};

test('cinematic is bounded, deterministic, uses actual species, and has high-rarity musical ending',()=>{
 const original=JSON.stringify(batch),rng=Math.random;Math.random=()=>{throw new Error('presentation must not draw');};
 try{
  const full=revealFrames(batch,batch.results),quick=revealFrames(batch,batch.results,'quick');
  const duration=full.reduce((s,f)=>s+f.ticks,0);
  assert(duration>=300&&duration<=560);assert(quick.reduce((s,f)=>s+f.ticks,0)<duration/3);
  assert(full.some(f=>f.subtitle.includes('MAX STACK / 64連')));
  assert(full.findIndex(f=>f.title.includes('LEGENDARY'))>full.findIndex(f=>f.title.includes(MUSHROOMS[0].nameJa)));
  assert(full.flatMap(f=>f.sounds).length>=50);
  assert(full.every(f=>f.sounds.every(s=>s.volume<=0.7&&s.pitch>=0.4&&s.pitch<=2)));
  for(const f of full)for(const text of [f.title,f.subtitle])assert(text.endsWith('§r'));
  assert.deepEqual(revealFrames(batch,batch.results,'off'),[]);
  const common={count:1,results:[{id:'R01',amount:1}],fresh:[]};
  assert(!revealFrames(common,common.results).some(f=>f.title.includes('LEGENDARY')));
  assert.equal(JSON.stringify(batch),original);
 }finally{Math.random=rng;}
});
test('personal preferences cycle full/quick/off and sound independently, persisted per player',()=>{
 const {p}=setup();assert.deepEqual(revealPreferences(p),{mode:'full',sound:true});
 cycleRevealMode(p);assert.equal(revealPreferences(p).mode,'quick');
 toggleRevealSound(p);assert.equal(revealPreferences(p).sound,false);
 cycleRevealMode(p);assert.equal(revealPreferences(p).mode,'off');cycleRevealMode(p);
 assert.equal(revealPreferences(p).mode,'full');assert.equal(revealPreferences(new FakeEntity('other')).sound,true);
});
test('full reveal plays personal sound and finishes cleanly',async()=>{
 const {p,events}=setup();assert.equal(await drain(revealAppraisal(p,batch,batch.results)),'complete');
 assert(events.filter(e=>e.kind==='sound').length>50);
 assert.equal(events.at(-1).text,'');assert.equal(events.at(-2).title,'');
});
for(const reason of ['sneak','leave','death','dimension','new session'])test(`cancel on ${reason} with no trailing cues`,async()=>{
 const {p,events}=setup();let stopped=false,eventCount;
 const result=await drain(revealAppraisal(p,batch,batch.results),()=>{
  if(stopped)return;stopped=true;eventCount=events.length;
  if(reason==='sneak')p.isSneaking=true;
  if(reason==='leave'){sessions.delete(p.id);p.isValid=false;}
  if(reason==='death')p.health=0;
  if(reason==='dimension')p.dimension={id:'minecraft:nether'};
  if(reason==='new session')sessions.set(p.id,{npcId:'different'});
 });
 assert.equal(result,reason==='sneak'?'skipped':'aborted');
 assert.equal(events.slice(eventCount).filter(e=>e.kind==='sound').length,0);
 if(reason==='new session')assert.equal(events.length,eventCount,'new session display is untouched');
});
test('mute retains animation, OFF is instant; missing sound does not block result',async()=>{
 const {p,events}=setup();toggleRevealSound(p);
 assert.equal(await drain(revealAppraisal(p,batch,batch.results)),'complete');assert(!events.some(e=>e.kind==='sound'));
 events.length=0;cycleRevealMode(p);cycleRevealMode(p);
 assert.equal(await revealAppraisal(p,batch,batch.results),'complete');assert.equal(events.length,0);
 cycleRevealMode(p);toggleRevealSound(p);p.playSound=()=>{throw new Error('expected missing sound');};
 assert.equal(await drain(revealAppraisal(p,batch,batch.results)),'complete');
});
for(const mode of ['full','skip','display failure','disconnect','new session'])test(`real appraisal remains committed through ${mode}`,async()=>{
 const {p,npc,events}=setup();sessions.clear();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',64));
 let rolls=0;const rng=Math.random;Math.random=()=>{rolls++;return 0;};
 responses.push({selection:0},{selection:2},{canceled:true});
 if(mode==='display failure')p.onScreenDisplay.setTitle=()=>{throw new Error('expected screen failure');};
 let observed=false;
 try{
  await drain(openAppraiser(p,npc),()=>{
   assert.equal(receipt(p),null,'receipt cleared before any animation timer');
   assert.equal(p.c.getItem(0).amount,64);assert.equal(p.c.getItem(0).typeId,MUSHROOMS[0].itemId);
   assert.equal(counts(p).total,1);
   if(!observed){
    observed=true;
    if(mode==='skip')p.isSneaking=true;
    if(mode==='disconnect'){p.isValid=false;sessions.delete(p.id);}
    if(mode==='new session')sessions.set(p.id,{npcId:'new'});
   }
  });
 }finally{Math.random=rng;}
 assert.equal(rolls,65,'64 draws + one receipt ID, never re-roll');
 assert.equal(p.c.getItem(0).amount,64);assert.equal(counts(p).total,1);
 if(['disconnect','new session'].includes(mode))assert.equal(forms.length,1,'no stale result or menu');
 else assert.equal(forms.length,3);
 if(mode==='new session')assert.equal(sessions.get(p.id).npcId,'new');else assert.equal(sessions.size,0);
 assert.equal(events.filter(e=>e.kind==='sound'&&e.id==='random.chestopen').length,mode==='display failure'?0:1);
});
test('next-stack amount is refreshed after animation, not captured before it',async()=>{
 const {p,npc}=setup();sessions.clear();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',1));
 p.c.setItem(1,new ItemStack('minecraft:red_mushroom',64));
 const rng=Math.random;Math.random=()=>0;let edited=false;
 responses.push({selection:0},{selection:2},{canceled:true});
 try{await drain(openAppraiser(p,npc),()=>{if(!edited){edited=true;p.c.setItem(1,new ItemStack('minecraft:red_mushroom',12));}});}
 finally{Math.random=rng;}
 assert.equal(forms[1].form.buttons[0].label,'もう12連鑑定');
});
test('menu preference buttons do not appraise and survive reopening',async()=>{
 const {p,npc}=setup();sessions.clear();responses.push({selection:4},{selection:5},{canceled:true});
 await openAppraiser(p,npc);
 assert.deepEqual(revealPreferences(p),{mode:'quick',sound:false});
 assert(forms[2].form.buttons[4].label.includes('短縮'));assert(forms[2].form.buttons[5].label.includes('OFF'));
 assert.equal(counts(p).total,0);assert.equal(system.timers.size,0);
});

test('all species have themed musical identities and every 64-stack stays within 15–25 seconds',async()=>{
 const {speciesVoice}=await import('../pack/BP/scripts/mycology/reveal_sounds.js');
 const signatures=new Set();
 for(const d of MUSHROOMS){
  const voice=speciesVoice(d);signatures.add(JSON.stringify([voice.theme,voice.motif]));
  const others=MUSHROOMS.filter(x=>x.group===d.group&&x.rarity<=d.rarity&&x.id!==d.id).slice(0,4);
  const results=[{id:d.id,amount:64-others.length},...others.map(x=>({id:x.id,amount:1}))];
  const b={count:64,results,fresh:results.map(x=>x.id)};
  const frames=revealFrames(b,results);
  const ticks=frames.reduce((sum,f)=>sum+f.ticks,0);
  assert(ticks>=300&&ticks<=500,`${d.id}: ${ticks}`);assert(frames.every(f=>f.ticks>=2));
  assert(frames.every(f=>f.sounds.every(s=>s.pitch>=0.4&&s.pitch<=2)));
  assert(frames.some(f=>f.sounds.some(s=>s.id===voice.lead)));
  const quick=revealFrames(b,results,'quick');assert(quick.every(f=>f.ticks>=2));
  assert(quick.reduce((sum,f)=>sum+f.ticks,0)<=110);
 }
 assert.equal(signatures.size,35,'each species has a distinct theme/motif combination');
 assert.equal(speciesVoice(MUSHROOMS.find(d=>d.id==='R01')).theme,'bright');
 assert.equal(speciesVoice(MUSHROOMS.find(d=>d.id==='B16')).theme,'dark');
 assert.equal(speciesVoice(MUSHROOMS.find(d=>d.id==='B06')).theme,'spore');
});
