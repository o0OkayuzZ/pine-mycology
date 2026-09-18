import { MUSHROOMS as CLASSIC_MUSHROOMS } from './registry.js';
import { NETHER_FUNGI } from './nether_fungi_registry.js';
export const MUSHROOMS=[...CLASSIC_MUSHROOMS,...NETHER_FUNGI];
export const BY_ID=new Map(MUSHROOMS.map(x=>[x.id,x]));
export const BY_ITEM=new Map(MUSHROOMS.map(x=>[x.itemId,x]));
export const SOURCE_ITEMS=Object.freeze({red:'minecraft:red_mushroom',brown:'minecraft:brown_mushroom',crimson:'minecraft:crimson_fungus',warped:'minecraft:warped_fungus'});
