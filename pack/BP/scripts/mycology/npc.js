import { world,system,ItemStack } from '@minecraft/server';
import { CONFIG } from './config.js';
import { sessions,hasNpcSession } from './sessions.js';
import { readJSON,writeJSON,validEntity,entityById,distance2,logError } from './util.js';
let expiryTimer;
function lease(){return readJSON(world,CONFIG.leaseKey,null);}
function saveLease(value){writeJSON(world,CONFIG.leaseKey,value??undefined);}
function token(entity){return entity.getDynamicProperty(CONFIG.naturalTokenKey);}
function activeMatches(entity,l){return !!l&&l.entityId===entity.id&&l.token===token(entity);}
function retire(entity){if(validEntity(entity))entity.remove();} // Not kill(): retirement never triggers death loot.
function closeLease(l){
 if(expiryTimer!==undefined){system.clearRun(expiryTimer);expiryTimer=undefined;}
 const old=entityById(l.entityId);
 if(validEntity(old))retire(old);
 saveLease(null);
}
export function canUse(player,npc,existingSession=false){
 if(!validEntity(player)||!validEntity(npc)||npc.typeId!==CONFIG.npcType)return false;
 if(player.dimension.id!==npc.dimension.id||distance2(player.location,npc.location)>CONFIG.interactionDistance**2)return false;
 if(!token(npc))return true; // Administrative test individual, no natural loot.
 const l=lease();if(!activeMatches(npc,l))return false;
 const now=Date.now();return now<l.expiresAt || (existingSession&&now<l.expiresAt+CONFIG.maxGraceMs);
}
export function requireUsable(player,npc,existingSession=true){
 if(!canUse(player,npc,existingSession))throw new Error('鑑定士が不在・遠距離・滞在終了のため鑑定できません。アイテムは消費していません。');
}
function armExpiry(l){
 if(expiryTimer!==undefined)system.clearRun(expiryTimer);
 const left=Math.max(1,Math.ceil((l.expiresAt-Date.now())/50));
 expiryTimer=system.runTimeout(checkExpiry,Math.min(left,2147483647));
}
function checkExpiry(){
 expiryTimer=undefined;
 try{
  const l=lease();if(!l)return;
  const now=Date.now();
  if(now<l.expiresAt){armExpiry(l);return;}
  if(now<l.expiresAt+CONFIG.maxGraceMs&&hasNpcSession(l.entityId)) {
   // At most 30 ten-second checks, only while the grace period is in progress.
   expiryTimer=system.runTimeout(checkExpiry,Math.min(200,Math.max(1,Math.ceil((l.expiresAt+CONFIG.maxGraceMs-now)/50))));return;
  }
  closeLease(l);
 }catch(error){logError('NPC expiry',error);}
}
function reconcileLoaded(entity){
 if(entity.typeId!==CONFIG.npcType||!token(entity))return;
 const l=lease();
 if(!activeMatches(entity,l)){retire(entity);return;}
 if(Date.now()>=l.expiresAt && !hasNpcSession(entity.id)){closeLease(l);return;}
 armExpiry(l);
}
function island(dimension,location){
 const biome=dimension.getBiome(location);
 return CONFIG.islandBiomeIds.includes(biome.id)||CONFIG.islandBiomeTags.some(tag=>typeof biome.hasTags==='function'&&biome.hasTags([tag]));
}
// Stable API has no Block.isSolid. Restrict landing surfaces to known full
// terrain cubes; unknown/custom blocks and partial blocks fail closed.
const safeTerrain=new Set(['grass_block','dirt','coarse_dirt','dirt_with_roots','mycelium','podzol',
 'stone','granite','diorite','andesite','deepslate','tuff','calcite','gravel','sand','red_sand',
 'sandstone','red_sandstone','terracotta','hardened_clay','snow','snow_block','clay','moss_block',
 'mud','packed_mud','bedrock'].map(id=>'minecraft:'+id));
/** @param {import('@minecraft/server').Block | undefined} block */
function safeFloor(block){return !!block&&!block.isWaterlogged&&safeTerrain.has(block.typeId);}
/** @param {import('@minecraft/server').Dimension} dimension */
function groundAt(dimension,x,z){
 try {
  const b=dimension.getTopmostBlock({x:Math.floor(x),z:Math.floor(z)});if(!safeFloor(b))return null;
  const feet={x:b.location.x+0.5,y:b.location.y+1,z:b.location.z+0.5};
  const air1=dimension.getBlock(feet),air2=dimension.getBlock({x:feet.x,y:feet.y+1,z:feet.z});
  if(!air1?.isAir||!air2?.isAir)return null;
  // Avoid a spawn with no neighboring floor (isolated pillars / sharp ledges).
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const support=dimension.getBlock({x:feet.x+dx,y:feet.y-1,z:feet.z+dz});
   if(!safeFloor(support))return null;
  }
  return feet;
 }catch{return null;} // Unloaded or out-of-bounds columns are expected, not force-loaded.
}
function eligible(player){
 if(player.dimension.id!=='minecraft:overworld')return false;
 if(String(player.getGameMode()).toLowerCase()==='spectator')return false;
 const p=groundAt(player.dimension,player.location.x,player.location.z);
 return !!p && Math.abs(p.y-player.location.y)<=6;
}
function attempt(players){
 if(!CONFIG.naturalSpawningEnabled)return;
 const l=lease();
 if(l){checkExpiry();if(lease())return;}
 const candidates=players.filter(eligible);if(!candidates.length)return;
 const islands=candidates.filter(p=>{try{return island(p.dimension,p.location);}catch{return false;}});
 const pool=islands.length?islands:candidates;
 const chosen=pool[Math.floor(Math.random()*pool.length)];
 const onIsland=islands.length>0;
 if(Math.random()>=(onIsland?CONFIG.islandChance:CONFIG.normalChance))return;
 const dim=chosen.dimension;
 for(let i=0;i<CONFIG.spawnAttempts;i++){
  const angle=Math.random()*Math.PI*2;
  const radius=Math.sqrt(CONFIG.spawnRadiusMin**2+Math.random()*(CONFIG.spawnRadiusMax**2-CONFIG.spawnRadiusMin**2));
  const spot=groundAt(dim,chosen.location.x+Math.cos(angle)*radius,chosen.location.z+Math.sin(angle)*radius);
  if(!spot)continue;
  // All players, not only the chosen target, get a minimum 24-block buffer.
  const tooClose=players.some(p=>p.dimension.id===dim.id&&distance2(p.location,spot)<CONFIG.spawnRadiusMin**2);
  const ds=distance2(chosen.location,spot);
  if(tooClose||ds>CONFIG.spawnRadiusMax**2||ds<CONFIG.spawnRadiusMin**2)continue;
  if(onIsland){try{if(!island(dim,spot))continue;}catch{continue;}}
  let npc;
  try{
   npc=dim.spawnEntity(CONFIG.npcType,spot);
   const t=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
   npc.setDynamicProperty(CONFIG.naturalTokenKey,t);
   const newLease={version:1,entityId:npc.id,token:t,dimensionId:dim.id,island:onIsland,
    expiresAt:Date.now()+(onIsland?CONFIG.islandLifetimeMs:CONFIG.normalLifetimeMs)};
   saveLease(newLease);armExpiry(newLease);return;
  }catch(error){if(validEntity(npc))retire(npc);logError('spawn',error);return;}
 }
}
export function initializeNpc(){
 // Only loaded entities are enumerated, once on startup. An unloaded lease is not
 // assumed dead. On later load, an old token loses eligibility and is removed.
 try{
  for(const id of ['overworld','nether','the_end'])for(const e of world.getDimension(id).getEntities({type:CONFIG.npcType}))reconcileLoaded(e);
  const l=lease();if(l)armExpiry(l);
 }catch(error){logError('initialize NPC',error);}
}
export function installNpc(){
 world.afterEvents.entityLoad.subscribe(e=>{try{reconcileLoaded(e.entity);}catch(error){logError('entity load',error);}});
 world.afterEvents.entityDie.subscribe(e=>{
  const npc=e.deadEntity;if(npc.typeId!==CONFIG.npcType)return;
  try{
   const l=lease();
   if(!activeMatches(npc,l))return;
   // An expired stale NPC cannot be farmed after unload/reload.
   if(Date.now()>=l.expiresAt+CONFIG.maxGraceMs){saveLease(null);return;}
   saveLease(null);
   if(expiryTimer!==undefined){system.clearRun(expiryTimer);expiryTimer=undefined;}
   const location=npc.location,dim=npc.dimension;
   dim.spawnItem(new ItemStack('minecraft:red_mushroom',64),location);
   dim.spawnItem(new ItemStack('minecraft:brown_mushroom',64),location);
  }catch(error){logError('natural death loot',error);}
 });
 world.afterEvents.playerLeave.subscribe(e=>sessions.delete(e.playerId));
 // One minute = 1200 ticks. Not a per-tick entity or inventory poll. Counts active
 // overworld minutes and persists the countdown; no offline catch-up spawn burst.
 system.runInterval(()=>{
  try{
   const players=world.getAllPlayers().filter(p=>p.dimension.id==='minecraft:overworld'&&String(p.getGameMode()).toLowerCase()!=='spectator');
   if(!players.length)return;
   const raw=world.getDynamicProperty(CONFIG.spawnClockKey);
   let minutes=raw===undefined?0:raw;
   if(typeof minutes!=='number'||!Number.isInteger(minutes)||minutes<0||minutes>=CONFIG.spawnIntervalMinutes)throw new Error('corrupt spawn countdown');
   minutes++;
   if(minutes>=CONFIG.spawnIntervalMinutes){world.setDynamicProperty(CONFIG.spawnClockKey,0);attempt(players);}
   else world.setDynamicProperty(CONFIG.spawnClockKey,minutes);
  }catch(error){logError('spawn clock',error);}
 },1200);
}
