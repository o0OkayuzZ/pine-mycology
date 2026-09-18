import { system } from '@minecraft/server';
import { speciesVoice } from './reveal_sounds.js';
import { BY_ID } from './registry.js';
import { sessions } from './sessions.js';
import { validEntity,logError } from './util.js';
import { rarityColor,rarityTier,stars,rarityHeadline,progressBar } from './rarity_ui.js';

const MODE_KEY='pinene:myco_reveal_mode';
const SOUND_KEY='pinene:myco_reveal_sound';
const MODES=['full','quick','off'];
export function revealPreferences(player){
  try{
    const mode=player.getDynamicProperty(MODE_KEY);
    return {mode:MODES.includes(mode)?mode:'full',sound:player.getDynamicProperty(SOUND_KEY)!==false};
  }catch{return {mode:'full',sound:true};}
}
export function cycleRevealMode(player){
  const mode=revealPreferences(player).mode;
  player.setDynamicProperty(MODE_KEY,MODES[(MODES.indexOf(mode)+1)%MODES.length]);
}
export function toggleRevealSound(player){
  player.setDynamicProperty(SOUND_KEY,!revealPreferences(player).sound);
}

// Pure presentation of an ALREADY committed result. No RNG, inventory writes,
// discovery writes or appraisal callbacks belong in this module.
export function revealFrames(batch,sorted,mode='full'){
  if(mode==='off')return [];
  const frames=[];
  const top=BY_ID.get(sorted[0].id);
  const voice=speciesVoice(top);
  const sound=(id,pitch=1,volume=0.5)=>({id,pitch,volume});
  const add=(ticks,title,subtitle,sounds=[])=>frames.push({
    ticks,title,subtitle,sounds
  });
  const countLabel=batch.count===64?'§6§lMAX STACK / 64連§r':`§a${batch.count}連鑑定§r`;
  add(30,'§a§l鑑定、開始。§r',countLabel,[sound('random.chestopen',0.8,0.65),sound('beacon.activate',1.2,0.25)]);

  // A rising roll, then a deliberate pause. Never tease a rarity not in the batch.
  const beats=batch.count===64?28:12;
  for(let i=0;i<beats;i++){
    const step=i+1,lit=Math.ceil(step*10/beats);
    add(i<beats/2?6:4,`§a${'◆'.repeat(lit)}§8${'◇'.repeat(10-lit)}§r`,
      `${countLabel}\n§7鑑定中… ${progressBar(step,beats,12)}§r`,
      [sound('note.hat',0.8+i*0.04,0.3),sound('note.pling',0.55+i/(beats-1)*1.3,0.35)]);
  }
  add(12,'§f§l…！§r','§7鑑定結果を開封§r',[]);

  // Show a few actual species first, ascending; the top result is saved for last.
  const highlights=sorted.slice(1,5).reverse();
  for(const r of highlights){
    const d=BY_ID.get(r.id),fresh=batch.fresh.includes(d.id),v=speciesVoice(d);
    add(20,`${rarityColor(d.rarity)}${d.nameJa}§r`,
      `${stars(d.rarity)} §f×${r.amount}§r${fresh?'\n§e§lNEW! 図鑑に登録§r':''}`,
      [sound('random.pop',0.85+d.rarity*0.07,0.45),sound(v.lead,v.pitch(v.motif[1]+d.rarity),0.45)]);
  }

  for(let rank=1;rank<=top.rarity;rank++){
    add(6+rank,`${rarityColor(rank)}${'★'.repeat(rank)}§8${'☆'.repeat(10-rank)}§r`,
      `§f最高レアを公開…§r\n${rarityColor(rank)}${rarityTier(rank)}§r`,
      [sound(voice.lead,voice.pitch(rank*2),0.5),sound('note.bd',0.7+rank*0.04,0.4)]);
  }
  add(top.rarity>=7?22:10,'§f§l・・・§r','§7最高レア、登場。§r',[]);
  add(20,rarityHeadline(top),`${rarityColor(top.rarity)}${top.nameJa}§r\n${stars(top.rarity)}`,
    [sound('random.levelup',top.rarity>=9?0.8:1.1,0.7),sound('random.explode',1.5,top.rarity>=7?0.3:0.12)]);

  // Short one-shot notes, not looping music; every cue belongs to this timeline.
  const melody=[...voice.motif,...(top.rarity===10?[12,17,19,24]:top.rarity===9?[12,15,19]:top.rarity>=7?[12,voice.third+12]:[])];
  for(const semitone of melody){
    const pitch=voice.pitch(semitone);
    add(6,`${rarityColor(top.rarity)}${top.nameJa}§r`,
      `${rarityHeadline(top)} §f×${sorted[0].amount}§r`,
      [sound(voice.lead,pitch,0.55),sound(voice.pad,pitch,0.35)]);
  }
  add(top.rarity>=9?48:40,`${rarityColor(top.rarity)}${top.nameJa}§r`,
    `${stars(top.rarity)}\n${batch.fresh.length?`§e§lNEW ${batch.fresh.length}種！§r`:'§a鑑定完了§r'}`,
    batch.fresh.length?[sound('random.orb',1.3,0.6)]:[]);
  // Keep 64-stack sequences within the chosen 15?25 seconds at 20 TPS,
  // regardless of how many species or how high a rarity was actually drawn.
  const naturalTicks=frames.reduce((sum,f)=>sum+f.ticks,0);
  const fullTicks=batch.count===64?Math.max(300,Math.min(500,naturalTicks)):Math.min(400,naturalTicks);
  const targetTicks=mode==='quick'?Math.round(fullTicks*0.22):fullTicks;
  if(mode==='quick'){
    let roll=0,rank=0;
    const compact=frames.filter(f=>{
      if(f.sounds[0]?.id==='note.hat')return roll++%3===0;
      if(f.sounds[1]?.id==='note.bd'){rank++;return rank%2===1||rank===top.rarity;}
      return true;
    });
    frames.splice(0,frames.length,...compact);
  }
  const weightTicks=frames.reduce((sum,f)=>sum+f.ticks,0);
  // Reserve two ticks per cue before distributing the rest, so a short mode
  // never gets a negative final hold after rounding many rapid cues.
  const spare=Math.max(0,targetTicks-frames.length*2);
  for(const frame of frames)frame.ticks=2+Math.floor(frame.ticks*spare/weightTicks);
  frames[frames.length-1].ticks+=targetTicks-frames.reduce((sum,f)=>sum+f.ticks,0);
  return frames;
}

export async function revealAppraisal(player,batch,sorted){
  const session=sessions.get(player.id);
  let display,dimension;
  // Missing/rejected presentation APIs must never hide a committed result form.
  try{display=player.onScreenDisplay;dimension=player.dimension.id;}catch{return 'unavailable';}
  if(!display||!session)return 'unavailable';
  const prefs=revealPreferences(player);
  if(prefs.mode==='off')return 'complete';
  const active=()=>{
    try{return validEntity(player)&&sessions.get(player.id)===session&&
      player.dimension.id===dimension&&player.getComponent('minecraft:health')?.currentValue>0;
    }catch{return false;}
  };
  let drew=false,soundAvailable=prefs.sound;
  try{
    if(!active())return 'aborted';
    for(const frame of revealFrames(batch,sorted,prefs.mode)){
      if(!active())return 'aborted';
      if(player.isSneaking)return 'skipped';
      display.setTitle(frame.title,{subtitle:frame.subtitle,fadeInDuration:0,stayDuration:frame.ticks+4,fadeOutDuration:4});
      drew=true;
      display.setActionBar('§7しゃがみで結果へスキップ§r');
      if(soundAvailable)for(const cue of frame.sounds){
        try{player.playSound(cue.id,{pitch:cue.pitch,volume:cue.volume});}
        catch(error){soundAvailable=false;logError('reveal sound',error);break;}
      }
      // One outstanding timer, checked at most every 2 ticks. It always settles,
      // including disconnect, death, dimension change and a replaced session.
      let remaining=frame.ticks;
      while(remaining>0){
        const step=Math.min(remaining,2);
        await new Promise(resolve=>system.runTimeout(()=>resolve(undefined),step));
        remaining-=step;
        if(!active())return 'aborted';
        if(player.isSneaking)return 'skipped';
      }
    }
    return 'complete';
  }catch(error){logError('reveal presentation',error);return active()?'unavailable':'aborted';}
  finally{
    // Never erase the display of a newer session or a respawned player.
    if(drew&&active()){
      try{display.setTitle('',{subtitle:'',fadeInDuration:0,stayDuration:0,fadeOutDuration:0});display.setActionBar('');}catch{}
    }
  }
}
