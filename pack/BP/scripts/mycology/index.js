import { world,system } from '@minecraft/server';
import { installEffects,resumeQueue } from './effects.js';
import { installNpc,initializeNpc } from './npc.js';
import { openAppraiser } from './ui.js';
import { installFieldGuide } from './field_guide.js';
import { reviewReceipt } from './appraisal.js';
import { CONFIG } from './config.js';
import { logError,tell } from './util.js';
installFieldGuide();
installEffects();
installNpc();
world.afterEvents.playerInteractWithEntity.subscribe(e=>{
 if(e.target.typeId!==CONFIG.npcType)return;
 system.run(()=>{void openAppraiser(e.player,e.target);});
});
world.afterEvents.worldLoad.subscribe(()=>{
 initializeNpc();
 for(const p of world.getAllPlayers())try{resumeQueue(p);}catch(error){logError('startup poison restore',error);}
});
// Emergency review tools require an operator-applied tag. Never grant this tag to
// ordinary players. Commands are intentionally manual: crash ambiguity cannot be
// resolved perfectly using the non-transactional Bedrock inventory API.
system.afterEvents.scriptEventReceive.subscribe(e=>{
 if(e.id!=='pinene:myco_receipt')return;
 const p=e.sourceEntity;
 if(!p||p.typeId!=='minecraft:player'||!p.hasTag('pinene:myco_admin'))return;
 try{tell(p,reviewReceipt(p,e.message.trim()));}catch(error){tell(p,String(error));}
});
