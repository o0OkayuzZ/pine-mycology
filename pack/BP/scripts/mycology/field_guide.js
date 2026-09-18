import { system } from '@minecraft/server';
import { encyclopedia } from './ui.js';
import { sessions } from './sessions.js';
import { logError } from './util.js';

// The book contains no progress. Always read the current player's saved discovery bits.
export async function openFieldGuide(player) {
 if(sessions.has(player.id))return;
 const session={kind:'field_guide'};
 sessions.set(player.id,session);
 try{await encyclopedia(player);}
 catch(error){logError('field guide',error);}
 finally{if(sessions.get(player.id)===session)sessions.delete(player.id);}
}

export function installFieldGuide() {
 system.beforeEvents.startup.subscribe(e=>{
  e.itemComponentRegistry.registerCustomComponent('pinene:myco_field_guide',{
   onUse:event=>{
    if(event.source.typeId!=='minecraft:player')return;
    system.run(()=>{void openFieldGuide(event.source);});
   }
  });
 });
}
