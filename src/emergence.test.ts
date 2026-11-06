import {describe,it,expect} from 'vitest';
import {World,biomeAt,biomeCost} from './engine';
describe('Genesis Emergence',()=>{
 it('assigns three spatial biomes',()=>{expect(biomeAt(10,20)).toBe('fertile');expect(biomeAt(450,20)).toBe('arid');expect(biomeAt(850,20)).toBe('extreme');expect(biomeCost('fertile')).toBeLessThan(biomeCost('extreme')); it('rejects corrupted or malicious snapshots',()=>{const w=new World(42);const cases=[{...w.snapshot(),rng:Infinity},{...w.snapshot(),food:[{x:Infinity,y:0}]},{...w.snapshot(),config:{...w.config,foodRate:-1}},{...w.snapshot(),organisms:[{...w.organisms[0],genome:{...w.organisms[0].genome,efficiency:0}}]}];for(const sample of cases)expect(()=>World.restore(sample)).toThrow();});
});
 it('starts with both ecological roles',()=>{const w=new World(42);expect(w.organisms.some(o=>o.species==='predator')).toBe(true);expect(w.organisms.some(o=>o.species==='grazer')).toBe(true);});
 it('inherits species and records parent identifiers',()=>{const w=new World(42,{foodRate:9});w.advance(350);for(const o of w.organisms){expect(['predator','grazer']).toContain(o.species);if(o.generation>0)expect(o.parentId).toBeGreaterThan(0);}});
 it('replays ecology exactly from seed',()=>{const a=new World(73),b=new World(73);a.advance(500);b.advance(500);expect(a.snapshot()).toEqual(b.snapshot());});
 it('restores previous snapshots without species fields',()=>{const w=new World(12);const s=w.snapshot();for(const o of s.organisms){delete (o as unknown as Record<string,unknown>).species;delete (o as unknown as Record<string,unknown>).parentId;}const restored=World.restore(s);expect(restored.organisms.every(o=>o.species==='grazer'&&o.parentId===null)).toBe(true);});
});
