// Pure, engine-independent logic. No world calls, timers, filesystem or network.
export const WORD_BITS = 30;
export function weight(rarity) {
  if (!Number.isInteger(rarity) || rarity < 1 || rarity > 10) throw new RangeError('rarity must be 1..10');
  return 2 ** (10 - rarity);
}
export function makeTable(definitions) {
  if (!definitions.length) throw new RangeError('empty appraisal table');
  let total = 0;
  const entries = definitions.map(d => ({ definition:d, upper:(total += weight(d.rarity)) }));
  return { entries, total };
}
export function draw(table, rng = Math.random) {
  const u = rng();
  if (!(u >= 0 && u < 1)) throw new RangeError('RNG must return [0,1)');
  const ticket = Math.floor(u * table.total);
  let lo = 0, hi = table.entries.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (ticket < table.entries[mid].upper) hi = mid; else lo = mid + 1; }
  return table.entries[lo].definition;
}
export function rollBatch(table, count, rng = Math.random) {
  if (!Number.isInteger(count) || count < 1 || count > 64) throw new RangeError('one source stack, 1..64 only');
  const result = new Map();
  for (let i = 0; i < count; i++) { const d = draw(table, rng); result.set(d.id, (result.get(d.id) ?? 0) + 1); }
  return [...result].map(([id,amount]) => ({id,amount})).sort((a,b) => a.id.localeCompare(b.id));
}
export function bitAddress(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('invalid immutable discovery index');
  return { word:Math.floor(index / WORD_BITS), bit:index % WORD_BITS };
}
export function validWord(value) { return Number.isInteger(value) && value >= 0 && value < 2 ** WORD_BITS; }
export function hasBit(word,index) {
  if (!validWord(word)) throw new TypeError('corrupt progress word');
  const bit = bitAddress(index).bit;
  return Math.floor(word / 2 ** bit) % 2 === 1;
}
export function withBit(word,index) { return hasBit(word,index) ? word : word + 2 ** bitAddress(index).bit; }
export function selectFirstStack(slots,typeId) {
  const index = slots.findIndex(s => s?.typeId === typeId && s.amount > 0);
  return index < 0 ? null : { slot:index, amount:slots[index].amount, typeId };
}
// Generic slots have typeId, amount, maxAmount and optional mergeKey. Engine wrapper
// assigns a unique mergeKey to each metadata-bearing stack; plain results only merge
// with matching, metadata-free stacks verified by ItemStack.isStackableWith.
export function planInventory(slots, source, outputs) {
  const actual = slots[source.slot];
  if (!actual || actual.typeId !== source.typeId || actual.amount !== source.amount) throw new Error('source changed');
  if (!Number.isInteger(source.amount) || source.amount < 1 || source.amount > 64) throw new RangeError('invalid source');
  if (outputs.reduce((n,x) => n+x.amount,0) !== source.amount) throw new Error('result conservation failed');
  const next = slots.map(x => x ? {...x} : null);
  next[source.slot] = null;
  const overflow = [];
  for (const o of outputs) {
    if (!Number.isInteger(o.amount) || o.amount < 1 || o.amount > 64) throw new RangeError('invalid result amount');
    let remaining = o.amount;
    for (let i=0;i<next.length && remaining;i++) {
      const s=next[i];
      if (!s || s.typeId!==o.typeId || s.mergeKey!==(o.mergeKey??o.typeId)) continue;
      const amount=Math.min(remaining,(s.maxAmount??64)-s.amount);
      s.amount+=amount;remaining-=amount;
    }
    for (let i=0;i<next.length && remaining;i++) if (!next[i]) {
      const amount=Math.min(remaining,o.maxAmount??64);
      next[i]={typeId:o.typeId,amount,maxAmount:o.maxAmount??64,mergeKey:o.mergeKey??o.typeId};remaining-=amount;
    }
    if (remaining) overflow.push({typeId:o.typeId,amount:remaining});
  }
  return { slots:next, overflow };
}
export function progressUpdates(definitions, readWord) {
  const updates = new Map(), discovered=[];
  for (const d of definitions) {
    const a=bitAddress(d.indexInGroup), key=`${d.group}:${a.word}`;
    const old=updates.has(key)?updates.get(key):readWord(d.group,a.word);
    if (!hasBit(old,d.indexInGroup)) {updates.set(key,withBit(old,d.indexInGroup));discovered.push(d.id);}
  }
  return {updates,discovered};
}
