/*
 * Mycology UI rarity palette
 *
 * ★1  gray
 * ★2  green
 * ★3  aqua
 * ★4  blue
 * ★5  light purple
 * ★6  dark purple
 * ★7  yellow
 * ★8  gold
 * ★9  red + bold
 * ★10 gold + bold
 *
 * Keep this mapping centralized so encyclopedia/detail/result screens never drift.
 */
export function rarityColor(rarity){
  switch(rarity){
    case 1:return '§7';
    case 2:return '§a';
    case 3:return '§b';
    case 4:return '§9';
    case 5:return '§d';
    case 6:return '§5';
    case 7:return '§e';
    case 8:return '§6';
    case 9:return '§c§l';
    case 10:return '§6§l';
    default:return '§f';
  }
}

export function rarityTier(rarity){
  if(rarity===10)return 'LEGENDARY';
  if(rarity===9)return 'MYTHIC';
  if(rarity===8)return 'ULTRA RARE';
  if(rarity===7)return 'SUPER RARE';
  if(rarity>=5)return 'RARE';
  if(rarity>=3)return 'UNCOMMON';
  return 'COMMON';
}

export function stars(rarity){
  return `${rarityColor(rarity)}${'★'.repeat(rarity)}§8${'☆'.repeat(10-rarity)}§r`;
}

export function coloredSpecies(d){
  return `${rarityColor(d.rarity)}${d.id} ${d.nameJa}§r`;
}

export function rarityHeadline(d){
  const c=rarityColor(d.rarity);
  if(d.rarity===10)return `${c}✦ LEGENDARY ✦§r`;
  if(d.rarity===9)return `${c}✦ MYTHIC ✦§r`;
  if(d.rarity===8)return `${c}◆ ULTRA RARE ◆§r`;
  if(d.rarity===7)return `${c}◆ SUPER RARE ◆§r`;
  return `${c}${rarityTier(d.rarity)}§r`;
}

export function progressBar(current,total,width=20){
  if(total<=0)return '';
  const filled=Math.max(0,Math.min(width,Math.round(current/total*width)));
  return `§a${'█'.repeat(filled)}§8${'░'.repeat(width-filled)}§r`;
}
