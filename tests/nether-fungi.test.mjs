import test from 'node:test';
import assert from 'node:assert/strict';
import { NETHER_FUNGI, NF_BY_ID, NF_BY_ITEM } from '../pack/BP/scripts/mycology/nether_registry.js';

test('NF catalog is complete and stable',()=>{
  assert.equal(NETHER_FUNGI.length,100);
  assert.equal(NF_BY_ID.size,100);
  assert.equal(NF_BY_ITEM.size,100);
  assert.deepEqual(NETHER_FUNGI.map(x=>x.id),Array.from({length:100},(_,i)=>`NF-${String(i+1).padStart(3,'0')}`));
  for(const group of ['crimson','warped']){
    const defs=NETHER_FUNGI.filter(x=>x.group===group);
    assert.equal(defs.length,50);
    assert.deepEqual(defs.map(x=>x.indexInGroup),Array.from({length:50},(_,i)=>i));
  }
  for(const d of NETHER_FUNGI){
    const n=d.id.slice(3);
    assert.equal(d.itemId,`pinene:nf_${n}`);
    assert.equal(d.textureKey,`pinene_myco_nf_${n}`);
    assert.equal(d.texturePath,`textures/items/nether_fungi/nf_${n}`);
    assert.ok(Number.isInteger(d.drawWeight)&&d.drawWeight>0);
    assert.ok(Number.isInteger(d.rarity)&&d.rarity>=1&&d.rarity<=10);
  }
});
