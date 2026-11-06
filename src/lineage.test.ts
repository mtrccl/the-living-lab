import {describe,it,expect} from 'vitest';
import {World} from './engine';
describe('persistent genealogy',()=>{
 it('records founding organisms and their genomes',()=>{
  const w=new World(42);
  expect(w.lineage).toHaveLength(32);
  expect(w.lineage.every(a=>a.parentId===null&&a.bornTick===0&&a.diedTick===null)).toBe(true);
 });
 it('records children and retains dead ancestors',()=>{
  const w=new World(42,{foodRate:10});
  w.advance(350);
  expect(w.lineage.length).toBeGreaterThanOrEqual(32);
  expect(w.lineage.some(a=>a.diedTick!==null)).toBe(true);
  for(const a of w.lineage.filter(a=>a.parentId!==null)){
   const parent=w.lineage.find(p=>p.id===a.parentId);
   expect(parent).toBeDefined();
   expect(parent!.generation).toBe(a.generation-1);
   expect(parent!.bornTick).toBeLessThanOrEqual(a.bornTick);
  }
 });
 it('restores genealogy and deterministic continuation',()=>{
  const a=new World(7);a.advance(250);
  const b=World.restore(a.snapshot());
  expect(b.lineage).toEqual(a.lineage);
  a.advance(100);b.advance(100);
  expect(b.snapshot()).toEqual(a.snapshot());
 });
 it('loads older snapshots without genealogy',()=>{
  const w=new World(7);const snapshot=w.snapshot();
  delete snapshot.lineage;
  const restored=World.restore(snapshot);
  expect(restored.lineage).toHaveLength(restored.organisms.length);
 });
 it('rejects forged lineage records',()=>{
  const w=new World(7);const snapshot=w.snapshot();
  snapshot.lineage[0].id=snapshot.nextId+1;
  expect(()=>World.restore(snapshot)).toThrow();
 });
});
