import {describe,it,expect} from 'vitest';
import {World} from './engine';
import {chooseSteering} from './behavior';
describe('natural selection behaviors',()=>{
 it('grazers flee predators even when food is nearby',()=>{
  const w=new World(7);
  const grazer={...w.organisms.find(o=>o.species==='grazer')!,x:100,y:100};
  const predator={...w.organisms.find(o=>o.species==='predator')!,x:110,y:100};
  const steering=chooseSteering(grazer,[grazer,predator],[{x:105,y:100}],0);
  expect(steering.mode).toBe('flee');
  expect(steering.x).toBeLessThan(0);
 });
 it('grazers forage when there is no visible threat',()=>{
  const w=new World(7);
  const grazer={...w.organisms.find(o=>o.species==='grazer')!,x:100,y:100};
  const steering=chooseSteering(grazer,[grazer],[{x:105,y:100}],0);
  expect(steering.mode).toBe('forage');
  expect(steering.x).toBeGreaterThan(0);
 });
 it('predators pursue visible grazers',()=>{
  const w=new World(7);
  const grazer={...w.organisms.find(o=>o.species==='grazer')!,x:110,y:100};
  const predator={...w.organisms.find(o=>o.species==='predator')!,x:100,y:100};
  const steering=chooseSteering(predator,[grazer,predator],[],0);
  expect(steering.mode).toBe('hunt');
  expect(steering.x).toBeGreaterThan(0);
 });
 it('simulation remains reproducible across save and restore',()=>{
  const a=new World(59);
  a.advance(100);
  const b=World.restore(a.snapshot());
  a.advance(200);b.advance(200);
  expect(a.snapshot()).toEqual(b.snapshot());
 });
});
