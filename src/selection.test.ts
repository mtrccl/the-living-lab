import {describe,it,expect} from 'vitest';
import {World} from './engine';
import {analyzeSelection} from './selection';
describe('selection analysis',()=>{
 it('counts founder families and living descendants',()=>{
  const w=new World(42,{foodRate:8});w.advance(200);
  const r=analyzeSelection(w.lineage);
  expect(r.founders).toHaveLength(32);
  expect(r.living).toBe(w.organisms.length);
  expect(r.historical).toBe(w.lineage.length);
  expect(r.founders.reduce((n,f)=>n+f.descendants,0)).toBe(w.lineage.length-32);
  expect(r.founders.reduce((n,f)=>n+f.livingDescendants,0)).toBe(r.living);
 });
 it('is deterministic for equal world seeds',()=>{
  const a=new World(9),b=new World(9);a.advance(180);b.advance(180);
  expect(analyzeSelection(a.lineage)).toEqual(analyzeSelection(b.lineage));
 });
 it('handles extinct families and empty history',()=>{
  const w=new World(42);expect(analyzeSelection([]).founders).toEqual([]);
  const l=w.lineage.map(a=>({...a,diedTick:1}));
  const r=analyzeSelection(l);
  expect(r.extinctFounders).toBe(32);
  expect(r.living).toBe(0);
 });
 it('rejects circular ancestry',()=>{
  const w=new World(42);const a={...w.lineage[0],parentId:2},b={...w.lineage[1],parentId:1};
  expect(()=>analyzeSelection([a,b])).toThrow('Cyclic lineage');
 });
});
