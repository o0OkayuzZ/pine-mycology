import test from 'node:test';import assert from 'node:assert/strict';
import { world,system,FakeEntity,ItemStack,Container,Dimension,reset } from './mock-minecraft.mjs';
import { appraise,recoverDelivery,receipt } from '../pack/BP/scripts/mycology/appraisal.js';
import { readWord,seen } from '../pack/BP/scripts/mycology/progress.js';
import { MUSHROOMS } from '../pack/BP/scripts/mycology/registry.js';
import { consume,installEffects } from '../pack/BP/scripts/mycology/effects.js';
import { installNpc,initializeNpc,canUse } from '../pack/BP/scripts/mycology/npc.js';
import { CONFIG } from '../pack/BP/scripts/mycology/config.js';
installNpc();installEffects();
const spawnMinute=[...system.intervals.values()].find(x=>x.ticks===1200).f;
function player(){const p=new FakeEntity('p');world.entities.set(p.id,p);return p;}
function withRandom(fn,rng){const old=Math.random;Math.random=rng;try{return fn();}finally{Math.random=old;}}
test('adapter: one 37-stack becomes 37 results, next 64 untouched',()=>{reset();const p=player();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',37));p.c.setItem(1,new ItemStack('minecraft:red_mushroom',64));const b=withRandom(()=>appraise(p,'red',()=>{}),()=>0);assert.equal(b.count,37);assert.equal(p.c.getItem(1).amount,64);assert.equal(p.c.getItem(0).typeId,MUSHROOMS[0].itemId);assert.equal(p.c.getItem(0).amount,37);assert.deepEqual(b.fresh,['R01']);assert.equal(receipt(p),null);});
test('adapter: invalid NPC before commit cannot consume input',()=>{reset();const p=player();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',64));assert.throws(()=>appraise(p,'red',()=>{throw new Error('dead NPC');}));assert.equal(p.c.getItem(0).amount,64);assert.equal(receipt(p),null);});
test('adapter: synchronous slot-write exception rolls back cloned inventory',()=>{reset();const p=player();p.c.setItem(0,new ItemStack('minecraft:red_mushroom',64));p.c.setItem(1,new ItemStack('minecraft:stone',17));p.c.failOnceAt=1;assert.throws(()=>appraise(p,'red',()=>{}));assert.equal(p.c.getItem(0).typeId,'minecraft:red_mushroom');assert.equal(p.c.getItem(1).amount,17);assert.equal(receipt(p),null);});
test('adapter: failed overflow spawn retains receipt, no re-roll; retry delivers once',()=>{
 reset();const p=player();p.c=new Container(1);p.c.setItem(0,new ItemStack('minecraft:red_mushroom',64));p.dimension.failDrop=true;let i=0;
 assert.throws(()=>withRandom(()=>appraise(p,'red',()=>{}),()=> (i++%2?0.2:0)));
 const r=receipt(p);assert.equal(r.stage,'delivered');assert(r.overflow.length>0);assert.equal(r.inFlight,null);
 const inventoryCount=p.c.getItem(0).amount;p.dimension.failDrop=false;const dropped=recoverDelivery(p);assert.equal(inventoryCount+dropped,64);assert.equal(receipt(p),null);assert.equal(recoverDelivery(p),0);
});
test('adapter: crash-ambiguous inflight receipt is quarantined',()=>{reset();const p=player();p.setDynamicProperty(CONFIG.receiptKey,JSON.stringify({stage:'delivered',inFlight:{typeId:'x',amount:1},results:[],overflow:[]}));assert.throws(()=>recoverDelivery(p));assert.equal(p.dimension.drops.length,0);});
test('adapter: legacy masks migrate without deleting old data',()=>{reset();const p=player();p.setDynamicProperty('pinene:myco_red_seen',5);assert.equal(readWord(p,'red',0),5);assert(seen(p,MUSHROOMS[0]));assert.equal(p.getDynamicProperty('pinene:myco_red_seen'),5);});
test('adapter: bad saved progress is rejected, not zeroed',()=>{reset();const p=player();p.setDynamicProperty('pinene:myco_seen_red_0','oops');assert.throws(()=>readWord(p,'red',0));assert.equal(p.getDynamicProperty('pinene:myco_seen_red_0'),'oops');});
test('adapter: poison is persistent before delay; repeated use cannot defer it',()=>{
 reset();const p=player(),d=MUSHROOMS.find(x=>x.id==='B16'),stack=new ItemStack(d.itemId);consume(p,stack);const q=JSON.parse(p.getDynamicProperty(CONFIG.poisonQueueKey));assert.equal(q[0].remainingTicks,400);assert.equal(p.effects.size,0);consume(p,stack);assert.equal(JSON.parse(p.getDynamicProperty(CONFIG.poisonQueueKey)).length,1);
 world.afterEvents.itemCompleteUse.emit({source:p,itemStack:new ItemStack('minecraft:milk_bucket')});assert.equal(p.getDynamicProperty(CONFIG.poisonQueueKey),undefined);
});
test('adapter: R06 fixed health cost then strength; lethal cost gives no buff',()=>{reset();const p=player(),d=MUSHROOMS.find(x=>x.id==='R06');consume(p,new ItemStack(d.itemId));assert.equal(p.health,18);assert.equal(p.effects.get('minecraft:strength').amplifier,0);p.effects.clear();p.health=2;consume(p,new ItemStack(d.itemId));assert.equal(p.health,0);assert.equal(p.effects.size,0);});
test('adapter: normal/admin NPC is usable but drops no loot on death',()=>{reset();const p=player(),n=new FakeEntity('n',CONFIG.npcType,p.dimension);n.location={x:3,y:64,z:0};world.entities.set(n.id,n);assert(canUse(p,n));world.afterEvents.entityDie.emit({deadEntity:n});assert.equal(p.dimension.drops.length,0);});
test('adapter: active natural death gives exactly 64+64 once',()=>{
 reset();const p=player(),n=new FakeEntity('n',CONFIG.npcType,p.dimension);world.entities.set(n.id,n);n.setDynamicProperty(CONFIG.naturalTokenKey,'natural');world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({version:1,entityId:'n',token:'natural',expiresAt:Date.now()+100000}));
 world.afterEvents.entityDie.emit({deadEntity:n});world.afterEvents.entityDie.emit({deadEntity:n});assert.deepEqual(p.dimension.drops.map(x=>[x.item.typeId,x.item.amount]),[['minecraft:red_mushroom',64],['minecraft:brown_mushroom',64]]);
});
test('adapter: stale loaded natural token is removed without loot',()=>{reset();const p=player(),n=new FakeEntity('old',CONFIG.npcType,p.dimension);n.setDynamicProperty(CONFIG.naturalTokenKey,'old');world.entities.set(n.id,n);world.afterEvents.entityLoad.emit({entity:n});assert.equal(n.isValid,false);assert.equal(p.dimension.drops.length,0);});
test('adapter: unloaded unexpired natural lease is preserved on restart',()=>{reset();player();const l={version:1,entityId:'unloaded',token:'x',expiresAt:Date.now()+100000};world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify(l));initializeNpc();assert.deepEqual(JSON.parse(world.getDynamicProperty(CONFIG.leaseKey)),l);});
test('adapter: grace only permits an existing session, then hard expires',()=>{reset();const p=player(),n=new FakeEntity('n',CONFIG.npcType,p.dimension);world.entities.set(n.id,n);n.setDynamicProperty(CONFIG.naturalTokenKey,'x');world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({entityId:'n',token:'x',expiresAt:Date.now()-1000}));assert.equal(canUse(p,n,false),false);assert.equal(canUse(p,n,true),true);world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({entityId:'n',token:'x',expiresAt:Date.now()-CONFIG.maxGraceMs-1000}));assert.equal(canUse(p,n,true),false);});

test('adapter: natural spawn works without experimental isSolid; rejects unsafe floors',()=>{
 for(const surface of ['minecraft:grass_block','minecraft:mycelium','minecraft:oak_slab','minecraft:water','custom:unknown','waterlogged']){
  reset();const p=player(),dim=p.dimension;
  dim.getTopmostBlock=({x,z})=>({location:{x,y:63,z},typeId:surface==='waterlogged'?'minecraft:grass_block':surface,isWaterlogged:surface==='waterlogged'});
  world.setDynamicProperty(CONFIG.spawnClockKey,CONFIG.spawnIntervalMinutes-1);
  withRandom(()=>spawnMinute(),()=>0);
  const lease=world.getDynamicProperty(CONFIG.leaseKey);
  assert.equal(!!lease,['minecraft:grass_block','minecraft:mycelium'].includes(surface),surface);
  if(lease){const npc=world.getEntity(JSON.parse(lease).entityId);assert(npc);assert(npc.location.x>=24);}
 }
});
