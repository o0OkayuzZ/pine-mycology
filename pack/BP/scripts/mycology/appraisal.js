import { ItemStack } from '@minecraft/server';
import { makeTable,rollBatch,selectFirstStack,planInventory } from './core.js';
import { MUSHROOMS,BY_ID } from './registry.js';
import { inventory,readJSON,writeJSON,logError } from './util.js';
import { registerDiscoveries } from './progress.js';
import { CONFIG } from './config.js';
const tables={red:makeTable(MUSHROOMS.filter(x=>x.group==='red')),brown:makeTable(MUSHROOMS.filter(x=>x.group==='brown'))};
const locks=new Set();
export function owned(player,group) {
 const c=inventory(player),id=`minecraft:${group}_mushroom`;
 const slots=Array.from({length:c.size},(_,i)=>c.getItem(i));
 return {total:slots.reduce((n,x)=>n+(x?.typeId===id?x.amount:0),0),first:selectFirstStack(slots,id)};
}
export function receipt(player) {return readJSON(player,CONFIG.receiptKey,null);}
function save(player,r) {writeJSON(player,CONFIG.receiptKey,r??undefined);}
export function recoverDelivery(player) {
 const r=receipt(player);if(!r)return 0;
 if(r.stage!=='delivered' || r.inFlight) throw new Error('前回の鑑定記録に復旧確認が必要です。管理者へ連絡してください。追加の消費は行いません。');
 registerDiscoveries(player,r.results.map(x=>BY_ID.get(x.id)).filter(Boolean));
 let dropped=0;
 while(r.overflow.length) {
  const next=r.overflow[0];
  // Crash ambiguity is quarantined, never blindly retried. A normal spawn failure
  // restores the pending state so that a later interaction can retry safely.
  r.inFlight={...next};save(player,r);
  try {player.dimension.spawnItem(new ItemStack(next.typeId,next.amount),player.location);}
  catch(error){r.inFlight=null;save(player,r);throw error;}
  r.overflow.shift();r.inFlight=null;save(player,r);dropped+=next.amount;
 }
 save(player,null);return dropped;
}
export function appraise(player,group,validateNpc) {
 if(locks.has(player.id))throw new Error('鑑定処理中です。');
 if(!tables[group])throw new Error('不明な鑑定区分です。');
 locks.add(player.id);
 try {
  validateNpc();recoverDelivery(player);validateNpc();
  const c=inventory(player),before=Array.from({length:c.size},(_,i)=>c.getItem(i));
  const input=`minecraft:${group}_mushroom`,source=selectFirstStack(before,input);
  if(!source)throw new Error('鑑定するキノコを持っていません。');
  const results=rollBatch(tables[group],source.amount),outputs=results.map(x=>({typeId:BY_ID.get(x.id).itemId,amount:x.amount}));
  const prototypes=new Map(outputs.map(x=>[x.typeId,new ItemStack(x.typeId,1)]));
  const simplified=before.map((s,i)=>s?{typeId:s.typeId,amount:s.amount,maxAmount:s.maxAmount,
    mergeKey:prototypes.has(s.typeId)&&s.isStackableWith(prototypes.get(s.typeId))?s.typeId:`preserve:${i}`} : null);
  const plan=planInventory(simplified,source,outputs);
  const after=plan.slots.map((s,i)=>{
    if(!s)return undefined;
    if(s.mergeKey.startsWith('preserve:'))return before[i]?.clone();
    if(before[i] && simplified[i]?.mergeKey===s.mergeKey){const copy=before[i].clone();copy.amount=s.amount;return copy;}
    return new ItemStack(s.typeId,s.amount);
  });
  // No await is allowed between revalidation, slot writes and receipt commitment.
  validateNpc();const current=c.getItem(source.slot);
  if(!current||current.typeId!==source.typeId||current.amount!==source.amount)throw new Error('対象スタックが変わりました。もう一度開いてください。');
  const r={version:1,txId:`${Date.now()}-${Math.random().toString(36).slice(2)}`,stage:'prepared',source,results,overflow:plan.overflow,inFlight:null};
  save(player,r);
  let written=0;
  try {
   for(let i=0;i<after.length;i++){c.setItem(i,after[i]);written++;}
   r.stage='delivered';save(player,r);
  } catch(error) {
   try{for(let i=0;i<before.length;i++)c.setItem(i,before[i]);save(player,null);}
   catch(rollbackError){logError('rollback requires manual review',rollbackError);}
   throw error;
  }
  const fresh=registerDiscoveries(player,results.map(x=>BY_ID.get(x.id)));
  const dropped=recoverDelivery(player);
  return {count:source.amount,results,fresh,dropped,sourceSlot:source.slot};
 } finally{locks.delete(player.id);}
}
// Operator-only recovery is exposed by main.js. Never auto-accept a prepared receipt:
// inventory may have been partly written when a process was killed.
export function reviewReceipt(player,action) {
 const r=receipt(player);if(!r)return '保留記録なし';
 if(action==='inspect')return JSON.stringify(r);
 if(action==='accept_committed') {r.stage='delivered';save(player,r);return '管理者判断で書込済みと確認しました。';}
 if(action==='discard_inflight') {
  if(r.inFlight){r.overflow.shift();r.inFlight=null;save(player,r);}return '出力済みとして保留スタックを確定しました。';
 }
 if(action==='retry_inflight') {r.inFlight=null;save(player,r);return '未出力と管理者が確認。次の操作で再配布します。';}
 if(action==='clear_after_manual_reconcile') {save(player,null);return '管理者の手動精算完了として記録を消去しました。';}
 throw new Error('Unknown recovery action');
}
