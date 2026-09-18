import { world,system } from '@minecraft/server';
import { ALL_BY_ITEM } from './catalog.js';
import { CONFIG } from './config.js';
import { readJSON,writeJSON,inventory,entityById,validEntity,logError } from './util.js';

const poisonQueues=new Map(),lethalQueues=new Map();let queueTimer;
function effect(target,f) {
 const id=`minecraft:${f.effect}`,amplifier=f.level-1,duration=Math.max(1,Math.round(f.seconds*20));
 const old=target.getEffect(id);
 if(old && (old.amplifier>amplifier || (old.amplifier===amplifier && old.duration>=duration)))return;
 target.addEffect(id,duration,{amplifier,showParticles:false});
}
function apply(target,list) {for(const f of list??[])effect(target,f);}
function storeQueue(player,q) {writeJSON(player,CONFIG.poisonQueueKey,q.length?q:undefined);}
function storeLethal(player,q) {writeJSON(player,CONFIG.nfLethalQueueKey,q.length?q:undefined);}
function clearPending(player) {
 poisonQueues.delete(player.id);lethalQueues.delete(player.id);
 storeQueue(player,[]);storeLethal(player,[]);
}
function validTimedQueue(q,kind){
 if(!Array.isArray(q)||q.some(x=>!Number.isFinite(x.remainingTicks)))throw new Error(`Invalid ${kind} queue record`);
}
export function resumeQueue(player) {
 const q=readJSON(player,CONFIG.poisonQueueKey,[]);validTimedQueue(q,'delayed poison');
 if(q.some(x=>!Array.isArray(x.effects)))throw new Error('Invalid delayed poison record');
 const lethal=readJSON(player,CONFIG.nfLethalQueueKey,[]);validTimedQueue(lethal,'NF lethal');
 if(q.length)poisonQueues.set(player.id,q);
 if(lethal.length)lethalQueues.set(player.id,lethal);
 if(q.length||lethal.length)startQueueTimer();
}
function lethalMessage(player,entry){
 const fallback=[
  `${player.name} は ${entry.id} の試食を生き延びられなかった`,
  `${player.name} に必要だったのは勇気ではなく牛乳だった`,
  `${player.name} の ${entry.id} 試食記録はここで途切れた`
 ];
 const specific={
  'NF-010':[`${player.name} は水を恐れたまま息絶えた`,`${player.name} は牛乳を探すには遅すぎた`,`${player.name} の理性は最後まで戻らなかった`],
  'NF-016':[`${player.name} の折り畳みは元に戻らなかった`,`${player.name} は正常なPrPを失った`,`${player.name} はプリオンに最後まで付き合わされた`],
  'NF-017':[`${player.name} はエボラウイルス茸を食べたことを後悔した`,`${player.name} に必要だったのは勇気ではなく牛乳だった`,`${player.name} はNF-017の試食係を退職した`]
 };
 const pool=specific[entry.id]??fallback;
 return pool[Math.floor(Math.random()*pool.length)];
}
function startQueueTimer() {
 if(queueTimer!==undefined)return;
 queueTimer=system.runInterval(()=>{
  for(const [id,q] of poisonQueues) {
   const player=entityById(id);
   if(!validEntity(player)){poisonQueues.delete(id);continue;}
   try {
    const due=[];for(const entry of q){entry.remainingTicks-=20;if(entry.remainingTicks<=0)due.push(entry);}
    const next=q.filter(x=>x.remainingTicks>0);storeQueue(player,next);
    if(next.length)poisonQueues.set(id,next);else poisonQueues.delete(id);
    for(const entry of due)apply(player,entry.effects);
   }catch(error){logError('delayed poison',error);poisonQueues.delete(id);}
  }
  for(const [id,q] of lethalQueues) {
   const player=entityById(id);
   if(!validEntity(player)){lethalQueues.delete(id);continue;}
   try {
    const due=[];for(const entry of q){entry.remainingTicks-=20;if(entry.remainingTicks<=0)due.push(entry);}
    const next=q.filter(x=>x.remainingTicks>0);storeLethal(player,next);
    if(next.length)lethalQueues.set(id,next);else lethalQueues.delete(id);
    if(due.length&&validEntity(player)){
     player.sendMessage('§4'+lethalMessage(player,due[0])+'§r');
     player.kill();
    }
   }catch(error){logError('NF lethal timer',error);lethalQueues.delete(id);}
  }
  if(!poisonQueues.size&&!lethalQueues.size){system.clearRun(queueTimer);queueTimer=undefined;}
 },20);
}
function schedulePoison(player,d) {
 const q=poisonQueues.get(player.id)??readJSON(player,CONFIG.poisonQueueKey,[]);
 const ticks=d.special.delaySeconds*20;
 const old=q.find(x=>x.id===d.id);
 if(old)old.remainingTicks=Math.min(old.remainingTicks,ticks);
 else q.push({id:d.id,remainingTicks:ticks,effects:d.special.effects});
 storeQueue(player,q);poisonQueues.set(player.id,q);startQueueTimer();
}
function scheduleLethal(player,d){
 if(!d.lethal||Math.random()>=d.lethal.chance)return;
 const q=lethalQueues.get(player.id)??readJSON(player,CONFIG.nfLethalQueueKey,[]);
 const ticks=d.lethal.delaySeconds*20,old=q.find(x=>x.id===d.id);
 if(old)old.remainingTicks=Math.min(old.remainingTicks,ticks);
 else q.push({id:d.id,remainingTicks:ticks});
 storeLethal(player,q);lethalQueues.set(player.id,q);startQueueTimer();
}
function livingNear(source,radius,maxEntities) {
 return source.dimension.getEntities({location:source.location,maxDistance:radius,closest:maxEntities,
  excludeTypes:['minecraft:item','minecraft:player','minecraft:xp_orb',CONFIG.npcType]})
  .filter(x=>validEntity(x)&&!!x.getComponent('minecraft:health'));
}
function puff(dimension,location) {try{dimension.spawnParticle('pinene:myco_spore',{x:location.x,y:location.y+1,z:location.z});}catch(error){logError('spore particle',error);}}
function sense(source,special) {
 const id=source.id;
 for(const seconds of special.timesSeconds) {
  const burst=()=>{const current=entityById(id);if(!validEntity(current))return;
   try{for(const target of livingNear(current,special.radius,special.maxEntities))puff(current.dimension,target.location);}catch(error){logError('sense',error);}};
  if(seconds===0)burst();else system.runTimeout(burst,seconds*20);
 }
}
export function consume(source,itemStack) {
 const d=ALL_BY_ITEM.get(itemStack?.typeId);
 if(!d||d.useMode!=='eat'||source.typeId!=='minecraft:player')return;
 try {
  if(d.special?.kind==='damage_first') {
   const hp=source.getComponent('minecraft:health');if(!hp)return;
   const next=hp.currentValue-d.special.damageHp;if(next<=0){source.kill();return;}hp.setCurrentValue(next);
  }
  apply(source,d.effects);
  if(d.special?.kind==='choice'){
   const list=d.special.choices,total=list.reduce((n,x)=>n+x.weight,0);let t=Math.random()*total;
   for(const x of list){t-=x.weight;if(t<0){apply(source,x.effects);break;}}
  }else if(d.special?.kind==='delayed')schedulePoison(source,d);
  else if(d.special?.kind==='sense')sense(source,d.special);
  else if(d.special?.kind==='random_debuff'&&d.special.choices?.length){
   apply(source,[d.special.choices[Math.floor(Math.random()*d.special.choices.length)]]);
  }
  scheduleLethal(source,d);
  itemStack.getComponent('minecraft:cooldown')?.startCooldown(source);
 } catch(error){logError(`consume ${d.id}`,error);}
}
const crushLock=new Map();
export function crush(source,itemStack) {
 const d=ALL_BY_ITEM.get(itemStack?.typeId);
 if(!d||d.useMode!=='crush'||source.typeId!=='minecraft:player')return;
 if((crushLock.get(source.id)??-100)<=system.currentTick-80) {
  try{
   const c=inventory(source),slot=source.selectedSlotIndex,held=c.getItem(slot);
   if(held?.typeId!==d.itemId)return;
   if(String(source.getGameMode()).toLowerCase()!=='creative') {
    if(held.amount===1)c.setItem(slot,undefined);else{held.amount--;c.setItem(slot,held);}
   }
   crushLock.set(source.id,system.currentTick);
   itemStack.getComponent('minecraft:cooldown')?.startCooldown(source);
   apply(source,d.effects);puff(source.dimension,source.location);
   for(const mob of livingNear(source,d.special.radius,d.special.maxEntities)){apply(mob,d.special.targetEffects);puff(source.dimension,mob.location);}
  }catch(error){logError('crush',error);}
 }
}
export function installEffects() {
 system.beforeEvents.startup.subscribe(e=>{
  e.itemComponentRegistry.registerCustomComponent('pinene:myco_consume',{onConsume:event=>consume(event.source,event.itemStack)});
  e.itemComponentRegistry.registerCustomComponent('pinene:myco_crush',{onUse:event=>crush(event.source,event.itemStack)});
 });
 world.afterEvents.itemCompleteUse.subscribe(e=>{
  if(e.itemStack.typeId==='minecraft:milk_bucket')try{clearPending(e.source);}catch(error){logError('milk clears Pine Mycology pending effects',error);}
 });
 world.afterEvents.playerSpawn.subscribe(e=>{
  try{if(e.initialSpawn)resumeQueue(e.player);else clearPending(e.player);}catch(error){logError('restore queue',error);}
 });
 world.afterEvents.playerLeave.subscribe(e=>{poisonQueues.delete(e.playerId);lethalQueues.delete(e.playerId);crushLock.delete(e.playerId);});
 world.afterEvents.entityDie.subscribe(e=>{
  if(e.deadEntity.typeId==='minecraft:player'){
   poisonQueues.delete(e.deadEntity.id);lethalQueues.delete(e.deadEntity.id);crushLock.delete(e.deadEntity.id);
   try{storeQueue(e.deadEntity,[]);storeLethal(e.deadEntity,[]);}catch{}
  }
 });
}
