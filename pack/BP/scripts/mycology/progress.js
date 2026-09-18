import { bitAddress, validWord, hasBit, progressUpdates } from './core.js';
import { MUSHROOMS } from './registry.js';
const key=(group,word)=>`pinene:myco_seen_${group}_${word}`;
export function readWord(player,group,word) {
 let value=player.getDynamicProperty(key(group,word));
 if (value===undefined && word===0) {
  const old=player.getDynamicProperty(`pinene:myco_${group}_seen`);
  if (old!==undefined) {
   if (!validWord(old)) throw new Error('旧図鑑データを安全に移行できません。');
   value=old;player.setDynamicProperty(key(group,0),old);
  }
 }
 if (value===undefined) return 0;
 if (!validWord(value)) throw new Error('図鑑データが破損しています。上書きを停止しました。');
 return value;
}
export function seen(player,d) {return hasBit(readWord(player,d.group,bitAddress(d.indexInGroup).word),d.indexInGroup);}
export function registerDiscoveries(player,definitions) {
 const {updates,discovered}=progressUpdates(definitions,(g,w)=>readWord(player,g,w));
 // Once per touched word (currently at most one per batch), not once per draw.
 for (const [k,value] of updates) {const [g,w]=k.split(':');player.setDynamicProperty(key(g,Number(w)),value);}
 player.setDynamicProperty('pinene:myco_data_version',1);
 return discovered;
}
export function counts(player) {
 const result={red:0,brown:0,total:0};
 for (const d of MUSHROOMS) if(seen(player,d)){result[d.group]++;result.total++;}
 return result;
}
