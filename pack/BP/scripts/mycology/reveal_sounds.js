// Sound design only. These groups describe in-game effects, not real edibility.
const THEMES={
  bright:{lead:'note.bell',pad:'note.harp',scale:[0,2,4,7,9,12,16],third:4},
  dark:{lead:'note.bass',pad:'note.didgeridoo',scale:[0,1,3,6,7,10,12],third:3},
  power:{lead:'note.bit',pad:'note.pling',scale:[0,2,4,7,9,12,14],third:4},
  mystic:{lead:'note.chime',pad:'note.flute',scale:[0,2,5,7,9,12,17],third:5},
  spore:{lead:'note.xylophone',pad:'note.hat',scale:[0,3,5,7,10,12,15],third:3}
};
const GROUPS={
  bright:['R01','R10','R12','B02','B04','B13','B14'],
  dark:['R02','R09','R11','R14','B08','B09','B10','B11','B16','B17','B19'],
  power:['R03','R04','R05','R06','R08','B01','B03','B05','B07','B20'],
  mystic:['R07','R13','R15','B12','B15','B18'],
  spore:['B06']
};
export function speciesVoice(d){
  const theme=Object.keys(GROUPS).find(k=>GROUPS[k].includes(d.id))??'bright';
  const voice=THEMES[theme];
  const seed=(d.group==='brown'?15:0)+Number(d.id.slice(1))-1;
  return {...voice,theme,motif:[0,voice.scale[seed%7],voice.scale[Math.floor(seed/7)%7],12],
    pitch:semitone=>Math.min(2,0.44*2**(semitone/12))};
}
