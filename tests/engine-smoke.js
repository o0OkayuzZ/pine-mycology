// TEST WORLD ONLY. Copy to scripts/engine-smoke.js and import from the test copy's main.js.
// This file is never installed in the production runtime. Uses real Bedrock objects.
import {world,system,ItemStack} from '@minecraft/server';
import {appraise,receipt} from './mycology/appraisal.js';
import {counts,seen} from './mycology/progress.js';
import {CONFIG} from './mycology/config.js';
import {MUSHROOMS} from './mycology/registry.js';
import {consume} from './mycology/effects.js';
const pause=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
function check(value,message){if(!value)throw new Error(message);}
let running=false;
async function run(p){
 if(running)return;running=true;
 const results=[];const dim=p.dimension,c=p.getComponent('minecraft:inventory').container;
 const clear=()=>{for(let i=0;i<c.size;i++)c.setItem(i);};
 const dropItems=()=>dim.getEntities({type:'minecraft:item',location:p.location,maxDistance:16});
 const cleanDrops=()=>{for(const e of dropItems())e.remove();};
 const tally=()=>{
  let n=0;for(let i=0;i<c.size;i++){const s=c.getItem(i);if(s&&s.typeId.match(/^pinene:[rb]_mushroom_/))n+=s.amount;}
  for(const e of dropItems()){const s=e.getComponent('minecraft:item').itemStack;if(s.typeId.match(/^pinene:[rb]_mushroom_/))n+=s.amount;}
  return n;
 };
 const test=async(name,fn)=>{try{await fn();results.push({name,pass:true});console.warn('[MYCO ENGINE] PASS '+name);}catch(e){results.push({name,pass:false,error:String(e)});console.warn('[MYCO ENGINE] FAIL '+name+' '+e.stack);}};
 try{
 await test('real inventory: red/brown every batch size 1..64 conserves quantity',async()=>{
  for(const group of ['red','brown'])for(let n=1;n<=64;n++){
   clear();cleanDrops();c.setItem(2,new ItemStack('minecraft:'+group+'_mushroom',n));
   const result=appraise(p,group,()=>{});check(result.count===n&&tally()===n,group+' '+n);check(!receipt(p),'receipt remains');await pause(1);
  }
 });
 await test('first partial slot only; named item and lore preserved',()=>{
  clear();cleanDrops();c.setItem(2,new ItemStack('minecraft:red_mushroom',19));c.setItem(7,new ItemStack('minecraft:red_mushroom',64));
  const custom=new ItemStack('minecraft:stone',17);custom.nameTag='MYCO preservation';custom.setLore(['keep metadata']);c.setItem(8,custom);
  const r=appraise(p,'red',()=>{});check(r.count===19&&c.getItem(7).amount===64,'second stack consumed');
  check(c.getItem(8).nameTag===custom.nameTag&&c.getItem(8).getLore()[0]==='keep metadata','metadata lost');
 });
 await test('full inventory: real spawnItem overflow conserves all 64',()=>{
  clear();cleanDrops();for(let i=0;i<c.size;i++)c.setItem(i,new ItemStack('minecraft:stone',64));
  c.setItem(2,new ItemStack('minecraft:brown_mushroom',64));const r=appraise(p,'brown',()=>{});
  check(tally()===64&&r.dropped>0,'overflow count');check(!receipt(p),'overflow receipt');
 });
 await test('invalid NPC callback rejects before consuming',()=>{
  clear();cleanDrops();c.setItem(0,new ItemStack('minecraft:red_mushroom',37));
  let rejected=false;try{appraise(p,'red',()=>{throw new Error('NPC absent');});}catch{rejected=true;}
  check(rejected&&c.getItem(0).amount===37,'invalid NPC consumed');
 });
 await test('give does not discover; progress uses real player DP',()=>{
  clear();const before=counts(p).total;c.setItem(0,new ItemStack('pinene:r_mushroom_r15',1));check(counts(p).total===before,'give discovered');
  world.setDynamicProperty('myco_test:expected_progress',JSON.stringify(counts(p)));
 });
 await test('real entityDie: admin NPC drops 0',async()=>{
  cleanDrops();const n=dim.spawnEntity(CONFIG.npcType,{x:p.location.x+5,y:p.location.y,z:p.location.z});n.kill();await pause(3);
  check(dropItems().filter(e=>e.getComponent('minecraft:item').itemStack.typeId.endsWith('_mushroom')).length===0,'admin loot');
 });
 await test('real entityDie: valid lease fixture drops 64+64',async()=>{
  cleanDrops();const n=dim.spawnEntity(CONFIG.npcType,{x:p.location.x+5,y:p.location.y,z:p.location.z});const token='engine-test-'+Date.now();
  n.setDynamicProperty(CONFIG.naturalTokenKey,token);
  world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({version:1,entityId:n.id,token,expiresAt:Date.now()+60000,dimensionId:dim.id}));
  n.kill();await pause(3);
  const sums={};for(const e of dropItems()){const s=e.getComponent('minecraft:item').itemStack;sums[s.typeId]=(sums[s.typeId]??0)+s.amount;}
  check(sums['minecraft:red_mushroom']===64&&sums['minecraft:brown_mushroom']===64,JSON.stringify(sums));
  check(!world.getDynamicProperty(CONFIG.leaseKey),'dead lease persisted');
 });
 await test('R06 direct handler: fixed 2HP cost on real health component',()=>{
  const hp=p.getComponent('minecraft:health');hp.setCurrentValue(20);consume(p,new ItemStack('pinene:r_mushroom_r06'));check(hp.currentValue===18,'HP cost');
 });
 clear();cleanDrops();for(let i=0;i<MUSHROOMS.length;i++)c.setItem(i,new ItemStack(MUSHROOMS[i].itemId,1));
 world.setDynamicProperty('myco_test:engine_results',JSON.stringify(results));
 p.sendMessage('[MYCO ENGINE] '+results.filter(r=>r.pass).length+'/'+results.length+' passed');
 console.warn('[MYCO ENGINE] RESULTS '+JSON.stringify(results));
 }finally{running=false;}
}
system.afterEvents.scriptEventReceive.subscribe(e=>{
 if(e.id==='myco_test:diagnose'&&e.sourceEntity?.typeId==='minecraft:player'){
  const p=e.sourceEntity,dim=p.dimension;
  try{const top=dim.getTopmostBlock({x:Math.floor(p.location.x),z:Math.floor(p.location.z)});
   console.warn('[MYCO ENGINE] SPAWN DIAG '+JSON.stringify({config:CONFIG,clock:world.getDynamicProperty(CONFIG.spawnClockKey),pos:p.location,dimension:dim.id,mode:p.getGameMode(),top:top?{pos:top.location,type:top.typeId,solid:top.isSolid}:null,biome:dim.getBiome(p.location).id}));
  }catch(error){console.warn('[MYCO ENGINE] SPAWN DIAG ERROR '+error.stack);}
 }
 if(e.id==='myco_test:natural'&&e.sourceEntity?.typeId==='minecraft:player'){
  const raw=world.getDynamicProperty(CONFIG.leaseKey),lease=raw?JSON.parse(raw):null;
  console.warn('[MYCO ENGINE] NATURAL LEASE '+JSON.stringify(lease));
  if(lease){
   const npc=world.getEntity(lease.entityId);
   if(npc){const dim=npc.dimension,pos=npc.location;npc.kill();system.runTimeout(()=>{
    const items=dim.getEntities({type:'minecraft:item',location:pos,maxDistance:4}).map(e=>{const s=e.getComponent('minecraft:item').itemStack;return {type:s.typeId,amount:s.amount};});
    console.warn('[MYCO ENGINE] NATURAL DEATH '+JSON.stringify(items));
   },3);}
  }
 }
 if(e.id==='myco_test:status'&&e.sourceEntity?.typeId==='minecraft:player'){
  const p=e.sourceEntity;const status={results:world.getDynamicProperty('myco_test:engine_results'),progress:counts(p),poison:p.getDynamicProperty(CONFIG.poisonQueueKey),effects:p.getEffects().map(x=>({type:x.typeId,amplifier:x.amplifier,duration:x.duration}))};
  console.warn('[MYCO ENGINE] STATUS '+JSON.stringify(status));p.sendMessage(JSON.stringify(status));
 }
 if(e.id==='myco_test:food'&&e.sourceEntity?.typeId==='minecraft:player'){
  const p=e.sourceEntity,c=p.getComponent('minecraft:inventory').container;
  c.setItem(0,new ItemStack('pinene:b_mushroom_b16',4));c.setItem(1,new ItemStack('minecraft:milk_bucket'));c.setItem(2,new ItemStack('pinene:b_mushroom_b06',4));p.selectedSlotIndex=0;
 }
 if(e.id==='myco_test:run'&&e.sourceEntity?.typeId==='minecraft:player')void run(e.sourceEntity);
 if(e.id==='myco_test:restore'&&e.sourceEntity?.typeId==='minecraft:player'){
  const p=e.sourceEntity,expected=world.getDynamicProperty('myco_test:expected_progress');
  const actual=JSON.stringify(counts(p));console.warn('[MYCO ENGINE] RESTART PROGRESS '+(actual===expected?'PASS':'FAIL')+' '+actual);p.sendMessage('Progress restore '+(actual===expected?'PASS':'FAIL'));
 }
});
world.afterEvents.itemCompleteUse.subscribe(e=>{
 if(!['pinene:b_mushroom_b16','minecraft:milk_bucket','pinene:r_mushroom_r14'].includes(e.itemStack.typeId))return;
 const p=e.source,id=e.itemStack.typeId,start=system.currentTick;
 for(const ticks of [1,40,420])system.runTimeout(()=>{
  const status={item:id,ticks:system.currentTick-start,poison:p.getDynamicProperty(CONFIG.poisonQueueKey),effects:p.getEffects().map(x=>({type:x.typeId,amplifier:x.amplifier,duration:x.duration}))};
  console.warn('[MYCO ENGINE] NATIVE USE '+JSON.stringify(status));
 },ticks);
});

// Test-world-only observation; never installed into repository runtime packs.
let watchedLease;
system.runInterval(()=>{
 const raw=world.getDynamicProperty(CONFIG.leaseKey),next=raw?JSON.parse(raw):null;
 if(next?.entityId===watchedLease?.entityId)return;
 const previous=watchedLease;watchedLease=next;
 let oldAlive=false;try{oldAlive=!!world.getEntity(previous?.entityId);}catch{}
 console.warn('[MYCO ENGINE] LEASE TRANSITION '+JSON.stringify({previous,next,oldAlive,time:Date.now()}));
},20);
