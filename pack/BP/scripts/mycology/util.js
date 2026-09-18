import { world } from '@minecraft/server';
export function logError(where,error) {console.warn(`[Pinene Mycology] ${where}: ${error?.stack ?? error}`);}
export function readJSON(owner,key,fallback) {
 const value=owner.getDynamicProperty(key);
 if (value===undefined) return fallback;
 if (typeof value!=='string') throw new Error(`Invalid saved property ${key}`);
 return JSON.parse(value);
}
export function writeJSON(owner,key,value) {owner.setDynamicProperty(key,value===undefined?undefined:JSON.stringify(value));}
export function inventory(player) {
 const c=player.getComponent('minecraft:inventory')?.container;
 if (!c) throw new Error('インベントリを利用できません。');
 return c;
}
export function validEntity(entity) {
 try {return !!entity && (typeof entity.isValid==='function' ? entity.isValid() : entity.isValid===true);} catch{return false;}
}
export function entityById(id) {try{return world.getEntity(id);}catch{return undefined;}}
export function distance2(a,b) {return (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;}
export function tell(player,message) {try{player.sendMessage(message);}catch(e){logError('message',e);}}
export function tr(key) {return {translate:key};}
