import test from 'node:test';import assert from 'node:assert/strict';
import { weight,makeTable,draw,rollBatch,bitAddress,hasBit,withBit,selectFirstStack,planInventory,progressUpdates } from '../pack/BP/scripts/mycology/core.js';
import { MUSHROOMS } from '../pack/BP/scripts/mycology/registry.js';
const red=MUSHROOMS.filter(x=>x.group==='red'),brown=MUSHROOMS.filter(x=>x.group==='brown');
test('35 immutable species, 15 red / 20 brown',()=>{assert.equal(red.length,15);assert.equal(brown.length,20);assert.equal(new Set(MUSHROOMS.map(x=>x.itemId)).size,35);for(const d of MUSHROOMS)assert.equal(d.indexInGroup,Number(d.id.slice(1))-1);});
test('weights 512..1, reject rarity zero and 11',()=>{assert.deepEqual(Array.from({length:10},(_,i)=>weight(i+1)),[512,256,128,64,32,16,8,4,2,1]);for(const n of [0,11,1.5,NaN])assert.throws(()=>weight(n));});
test('exact current sums: 2899 and 3183',()=>{assert.equal(makeTable(red).total,2899);assert.equal(makeTable(brown).total,3183);});
for(const [group,defs] of [['red',red],['brown',brown]])test(`${group}: exhaustively enumerate every integer ticket`,()=>{
 const t=makeTable(defs),seen=new Map();for(let i=0;i<t.total;i++){const d=draw(t,()=> (i+0.5)/t.total);seen.set(d.id,(seen.get(d.id)??0)+1);}
 for(const d of defs)assert.equal(seen.get(d.id),weight(d.rarity));
});
test('single draw boundaries and invalid RNG',()=>{const t=makeTable(red);assert.equal(draw(t,()=>0).id,'R01');assert.equal(draw(t,()=>1-Number.EPSILON).id,'R15');assert.throws(()=>draw(t,()=>1));});
test('all batch sizes conserve counts and aggregate duplicates',()=>{for(let n=1;n<=64;n++){const out=rollBatch(makeTable(red),n,()=>0);assert.deepEqual(out,[{id:'R01',amount:n}]);}for(const n of [0,65,1.5])assert.throws(()=>rollBatch(makeTable(red),n));});
test('first existing partial stack, not fullest or combined stacks',()=>{const slots=[null,{typeId:'minecraft:red_mushroom',amount:19},null,{typeId:'minecraft:red_mushroom',amount:64}];assert.deepEqual(selectFirstStack(slots,'minecraft:red_mushroom'),{slot:1,typeId:'minecraft:red_mushroom',amount:19});assert.equal(selectFirstStack(slots,'minecraft:brown_mushroom'),null);});
test('inventory plan consumes one exact stack and leaves the next',()=>{
 const a={typeId:'minecraft:red_mushroom',amount:37,mergeKey:'raw',maxAmount:64},b={...a,amount:64};const slots=[a,b,null];
 const p=planInventory(slots,{slot:0,typeId:a.typeId,amount:37},[{typeId:'result',amount:37}]);assert.equal(p.slots[0].amount,37);assert.equal(p.slots[1].amount,64);assert.equal(slots[0].amount,37);assert.equal(p.overflow.length,0);
});
test('full inventory preserves unrelated items and emits grouped overflow',()=>{
 const slots=[{typeId:'raw',amount:64},{typeId:'stone',amount:64,mergeKey:'preserve:1'}];
 const p=planInventory(slots,{slot:0,typeId:'raw',amount:64},[{typeId:'a',amount:40},{typeId:'b',amount:24}]);assert.equal(p.slots[1].typeId,'stone');assert.deepEqual(p.overflow,[{typeId:'b',amount:24}]);assert.equal(p.slots[0].amount+ p.overflow[0].amount,64);
});
test('matching plain stacks merge, named stacks are not overwritten',()=>{
 const slots=[{typeId:'raw',amount:20},{typeId:'a',amount:60,mergeKey:'a'},{typeId:'a',amount:10,mergeKey:'preserve:2'}];
 const p=planInventory(slots,{slot:0,typeId:'raw',amount:20},[{typeId:'a',amount:20}]);assert.equal(p.slots[1].amount,64);assert.equal(p.slots[0].amount,16);assert.equal(p.slots[2].amount,10);
});
test('changed source / nonconserved output fails before mutation',()=>{const slots=[{typeId:'raw',amount:3}];assert.throws(()=>planInventory(slots,{slot:0,typeId:'raw',amount:4},[{typeId:'a',amount:4}]));assert.throws(()=>planInventory(slots,{slot:0,typeId:'raw',amount:3},[{typeId:'a',amount:2}]));assert.equal(slots[0].amount,3);});
test('segmented progress addresses 0,29,30,31,59,60,90 independently',()=>{const words=new Map();for(const index of [0,29,30,31,59,60,90]){const a=bitAddress(index);words.set(a.word,withBit(words.get(a.word)??0,index));}for(const index of [0,29,30,31,59,60,90])assert(hasBit(words.get(bitAddress(index).word),index));assert.equal(hasBit(words.get(1),32),false);assert.deepEqual(bitAddress(30),{word:1,bit:0});});
test('one progress write per touched word and no duplicate NEW',()=>{const d=[red[0],red[0],red[2]];const p=progressUpdates(d,()=>0);assert.equal(p.updates.size,1);assert.deepEqual(p.discovered,['R01','R03']);const again=progressUpdates(d,()=>p.updates.get('red:0'));assert.equal(again.discovered.length,0);});
test('food/effect boundaries: specimens cannot eat; puffball is crush',()=>{assert.equal(MUSHROOMS.filter(x=>x.useMode==='specimen').length,2);assert.equal(MUSHROOMS.find(x=>x.id==='B06').useMode,'crush');assert.equal(MUSHROOMS.find(x=>x.id==='B16').special.delaySeconds,20);for(const x of MUSHROOMS)for(const f of [...x.effects,...(x.special?.effects??[])]){assert(f.seconds>0);assert(f.level>=1);}});
