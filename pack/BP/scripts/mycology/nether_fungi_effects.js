import { world,system } from '@minecraft/server';
import { CONFIG } from './config.js';
import { readJSON,writeJSON,entityById,validEntity,logError } from './util.js';
const queues=new Map();let timer;
function store(player,q){writeJSON(player,CONFIG.nfLethalQueueKey,q.length?q:undefined);}
function stopIfEmpty(){if(!queues.size&&timer!==undefined){system.clearRun(timer);timer=undefined;}}
function start(){if(timer!==undefined)return;timer=system.runInterval(()=>{
 for(const [id,q] of queues){const p=entityById(id);if(!validEntity(p)){queues.delete(id);continue;}try{
  for(const x of q)x.remainingTicks-=20;const due=q.filter(x=>x.remainingTicks<=0),next=q.filter(x=>x.remainingTicks>0);store(p,next);
  if(next.length)queues.set(id,next);else queues.delete(id);
  for(const x of due){const list=x.deathMessages?.length?x.deathMessages:['{name} は菌茸の症状に耐えられなかった'];const raw=list[Math.floor(Math.random()*list.length)];const name=p.name??p.nameTag??'プレイヤー';world.sendMessage('§c'+raw.replaceAll('{name}',name)+'§r');p.kill();break;}
 }catch(error){logError('NF lethal timer',error);queues.delete(id);}}
 stopIfEmpty();
},20);}
export function scheduleLethal(player,d){if(!d?.lethal||Math.random()>=d.lethal.chance)return;const q=queues.get(player.id)??readJSON(player,CONFIG.nfLethalQueueKey,[]);const ticks=Math.max(1,Math.round(d.lethal.delaySeconds*20));const old=q.find(x=>x.id===d.id);if(old)old.remainingTicks=Math.min(old.remainingTicks,ticks);else q.push({id:d.id,remainingTicks:ticks,deathMessages:d.lethal.deathMessages??[]});store(player,q);queues.set(player.id,q);start();}
export function clearLethal(player){queues.delete(player.id);store(player,[]);stopIfEmpty();}
export function resumeLethal(player){const q=readJSON(player,CONFIG.nfLethalQueueKey,[]);if(!Array.isArray(q))throw new Error('Invalid NF lethal record');if(q.length){queues.set(player.id,q);start();}}
export function forgetLethal(playerId){queues.delete(playerId);stopIfEmpty();}
