import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeEntity } from './mock-minecraft.mjs';
import { forms,responses } from './mock-forms.mjs';
import { openFieldGuide } from '../pack/BP/scripts/mycology/field_guide.js';
import { sessions } from '../pack/BP/scripts/mycology/sessions.js';

test('portable guide displays only its reader discoveries; no NPC or item progress required',async()=>{
 const discovered=new FakeEntity('discovered'),fresh=new FakeEntity('fresh');
 discovered.setDynamicProperty('pinene:myco_seen_red_0',1);
 for(const player of [discovered,fresh]){
  forms.length=0;responses.push({selection:0},{canceled:true},{canceled:true});
  await openFieldGuide(player);
  const entries=forms[1].form.buttons.slice(0,10);
  assert.equal(entries[0].label.includes('？？？？？'),player===fresh);
  assert(entries.slice(1).every(x=>x.label.includes('？？？？？')&&x.icon==='textures/ui/mycology/unknown'));
  assert.equal(sessions.has(player.id),false);
 }
 assert.equal(fresh.props.size,0,'reading does not discover or copy another player progress');
});

test('portable guide rejects duplicate opens and NPC lock; releases its lock on close/error',async()=>{
 const p=new FakeEntity('reader');forms.length=0;
 sessions.set(p.id,{npcId:'npc'});await openFieldGuide(p);assert.equal(forms.length,0);sessions.delete(p.id);
 let close;responses.push(()=>new Promise(resolve=>{close=resolve;}));
 const pending=openFieldGuide(p);await openFieldGuide(p);assert.equal(forms.length,1);
 close({canceled:true});await pending;assert.equal(sessions.has(p.id),false);
 responses.push(()=>Promise.reject(new Error('expected closed form')));
 await openFieldGuide(p);assert.equal(sessions.has(p.id),false);
});
