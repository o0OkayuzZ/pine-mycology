import { MUSHROOMS } from './registry.js';
import { NETHER_FUNGI } from './nether_registry.js';
export const ALL_FUNGI=[...MUSHROOMS,...NETHER_FUNGI];
export const ALL_BY_ID=new Map(ALL_FUNGI.map(x=>[x.id,x]));
export const ALL_BY_ITEM=new Map(ALL_FUNGI.map(x=>[x.itemId,x]));
export const GROUPS=Object.freeze({
 red:{inputItem:'minecraft:red_mushroom',label:'赤色キノコ',icon:'textures/items/mycology/r11'},
 brown:{inputItem:'minecraft:brown_mushroom',label:'茶色キノコ',icon:'textures/items/mycology/b01'},
 crimson:{inputItem:'minecraft:crimson_fungus',label:'深紅の菌茸',icon:'textures/items/mycology/nether/nf_001'},
 warped:{inputItem:'minecraft:warped_fungus',label:'歪んだ菌茸',icon:'textures/items/mycology/nether/nf_005'}
});
