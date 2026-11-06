import {describe,it,expect} from 'vitest';
import {World,defaults} from './engine';

const selected = {
 predatorExtraCost:0.03,
 predatorCatchRadius:14,
 predatorSpeedMultiplier:1.5,
 predatorInitialEnergy:115,
 predatorKillGain:80,
 grazerAlertMultiplier:0.3,
 predatorMinPreyRatio:7,
 predatorMetabolismFactor:0.3,
 predatorBirthEnergy:120,
} as const;

describe('Genesis ecology compatibility and conservation',()=>{
 it('keeps production defaults unchanged',()=>{
   const world=new World(83);
   expect(world.config.predatorExtraCost).toBe(0.16);
   expect(world.config.predatorCatchRadius).toBe(8);
   expect(world.config.predatorMinPreyRatio).toBe(0);
   expect(world.config.predatorMetabolismFactor).toBe(1);
   expect(world.config.predatorBirthEnergy).toBe(105);
   expect(world.config.predatorSpeedMultiplier).toBe(1);
   world.advance(300);
   expect(world.stats().predators).toBe(0);
 });

 it('restores legacy checkpoints without experimental fields',()=>{
   const world=new World(83);
   world.advance(20);
   const checkpoint=world.snapshot();
   for(const key of Object.keys(selected)){
     delete checkpoint.config[key];
   }
   const restored=World.restore(checkpoint);
   expect(restored.config).toEqual(defaults);
   expect(restored.stats()).toEqual(world.stats());
   restored.advance(10);
   expect(restored.tick).toBe(30);
 });

 it('does not respawn predators after their extinction',()=>{
   const world=new World(42,selected);
   world.organisms=world.organisms.filter(o=>o.species==='grazer');
   world.advance(600);
   expect(world.stats().predators).toBe(0);
 });

 it('does not create predator offspring without sufficient prey',()=>{
   const world=new World(42,selected);
   for(const o of world.organisms)if(o.species==='predator')o.energy=145;
   world.step();
   expect(world.stats().predators).toBe(5);
 });

 it('preserves population birth/death accounting and cap',()=>{
   const world=new World(83,{...selected,maxPopulation:120});
   world.advance(1300);
   expect(world.stats().population).toBe(32+world.births-world.deaths);
   expect(world.stats().population).toBeLessThanOrEqual(120);
 });

 it('replays selected parameters deterministically and restores',()=>{
   const a=new World(83,selected);
   a.advance(250);
   const b=World.restore(a.snapshot());
   a.advance(250);b.advance(250);
   expect(a.snapshot()).toEqual(b.snapshot());
 });
});
