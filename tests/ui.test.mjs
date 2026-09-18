import test from 'node:test';
import assert from 'node:assert/strict';
import { world,FakeEntity,ItemStack,reset } from './mock-minecraft.mjs';
import { forms,responses } from './mock-forms.mjs';
import { openAppraiser,encyclopedia } from '../pack/BP/scripts/mycology/ui.js';
import { MUSHROOMS } from '../pack/BP/scripts/mycology/registry.js';
import { registerDiscoveries } from '../pack/BP/scripts/mycology/progress.js';
import { receipt } from '../pack/BP/scripts/mycology/appraisal.js';
import { CONFIG } from '../pack/BP/scripts/mycology/config.js';
import { sessions } from '../pack/BP/scripts/mycology/sessions.js';

function setup(){
 reset();forms.length=0;responses.length=0;sessions.clear();
 const p=new FakeEntity('player');
 const npc=new FakeEntity('npc',CONFIG.npcType,p.dimension);
 world.entities.set(p.id,p);world.entities.set(npc.id,npc);
 return {p,npc};
}
function resetFormatting(value){
 if(typeof value==='string'){
  if(value.includes('§'))assert.equal(value.slice(value.lastIndexOf('§'),value.lastIndexOf('§')+2),'§r',value);
 }else if(value?.rawtext)for(const part of value.rawtext)resetFormatting(part.text);
}
for(const amount of [1,37,64])test(`result UI: ${amount} items, NEW, committed receipt, no next stack`,async()=>{
 const {p,npc}=setup();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',amount));
 const rng=Math.random;Math.random=()=>0;
 responses.push({selection:0},()=>{
  assert.equal(receipt(p),null,'result displayed after delivery completes');
  assert.equal(p.c.getItem(0).amount,amount);
  assert.equal(p.c.getItem(0).typeId,MUSHROOMS[0].itemId);
  return {selection:0};
 },{canceled:true});
 try{await openAppraiser(p,npc);}finally{Math.random=rng;}
 assert.equal(forms.length,3,'no-next button returns to menu without invalid appraisal');
 const result=forms[1].form;
 assert(result.heading.includes(`${amount}連`));
 assert(result.content.includes('§e§lNEW!§r'));
 assert(result.content.includes('図鑑：0 → §a1§r / 35'));
 assert.equal(result.content.includes('MAX STACK / 64連'),amount===64);
 assert.equal(result.buttons[0].label,'鑑定メニューへ戻る');
 assert.equal(p.messages.length,0);
 for(const {form} of forms){resetFormatting(form.heading);resetFormatting(form.content);form.buttons.forEach(b=>resetFormatting(b.label));}
 assert.equal(sessions.size,0);
});
for(const next of [12,64])test(`next batch button displays first stack ${next}, not total`,async()=>{
 const {p,npc}=setup();
 for(const [slot,amount] of [1,next,5].entries())p.c.setItem(slot,new ItemStack('minecraft:red_mushroom',amount));
 registerDiscoveries(p,[MUSHROOMS[0]]);
 const rng=Math.random;Math.random=()=>0;
 responses.push({selection:0},{selection:2},{canceled:true});
 try{await openAppraiser(p,npc);}finally{Math.random=rng;}
 const result=forms[1].form;
 assert(result.buttons[0].label.includes(next===64?'もう64連 / MAX STACK':`もう${next}連鑑定`));
 assert(!result.content.includes('NEW!'));assert(result.content.includes('図鑑：1 → §a1§r'));
 assert.equal(p.c.getItem(1).amount,next);assert.equal(p.c.getItem(2).amount,5);
});
test('unknown encyclopedia entries hide name and rarity, including after selection',async()=>{
 const {p}=setup();responses.push({selection:0},{selection:0},{canceled:true},{canceled:true});
 await encyclopedia(p);
 for(const index of [1,2])for(const [i,button] of forms[index].form.buttons.slice(0,10).entries()){
  assert.equal(button.label,`§8${MUSHROOMS[i].id} ？？？？？§r`);
  assert.equal(button.icon,'textures/ui/mycology/unknown');
 }
});
test('all ten rarity colors match in known list and detail; formatting resets',async()=>{
 const palette=['§7','§a','§b','§9','§d','§5','§e','§6','§c§l','§6§l'];
 for(let rarity=1;rarity<=10;rarity++){
  const {p}=setup(),d=MUSHROOMS.find(x=>x.rarity===rarity);
  registerDiscoveries(p,[d]);const defs=MUSHROOMS.filter(x=>x.group===d.group),i=defs.indexOf(d);
  responses.push({selection:d.group==='red'?0:1});
  if(i>=10)responses.push({selection:10});
  responses.push({selection:i%10},{canceled:true},{canceled:true},{canceled:true});
  await encyclopedia(p);
  const detail=forms.find(x=>x.form.heading===`${palette[rarity-1]}${d.nameJa}§r`).form;
  assert(detail.content.rawtext[0].text.includes(`${palette[rarity-1]}${d.id} ${d.nameJa}§r`));
  assert(forms.some(x=>x.form.buttons.some(b=>b.label.startsWith(`${palette[rarity-1]}${d.id} ${d.nameJa}§r`))));
  for(const {form} of forms){resetFormatting(form.heading);resetFormatting(form.content);form.buttons.forEach(b=>resetFormatting(b.label));}
 }
});
test('mixed batch is sorted by rarity, with highest banner and distinct NEW count',async()=>{
 const {p,npc}=setup();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',2));
 const rng=Math.random;let draw=0;Math.random=()=>draw++===0?0:0.999999;
 responses.push({selection:0},{selection:2},{canceled:true});
 try{await openAppraiser(p,npc);}finally{Math.random=rng;}
 const body=forms[1].form.content,lines=body.split('鑑定内訳')[1];
 const top=MUSHROOMS.filter(x=>x.group==='red').at(-1);
 assert.equal(top.rarity,10);
 assert(body.includes('§6§l✦ LEGENDARY ✦§r'));
 assert(body.includes('最高レア：§6§l★10 LEGENDARY§r'));
 assert(body.includes('新規発見：§e§l2種§r'));
 assert(body.includes('図鑑：0 → §a2§r'));
 assert(lines.indexOf(top.id)<lines.indexOf('R01'));
 assert.equal((lines.match(/NEW!/g)??[]).length,2);
});
