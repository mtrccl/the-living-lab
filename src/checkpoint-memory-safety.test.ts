import {describe,it,expect} from 'vitest';
import {MAX_LINEAGE,World} from './engine';
import {createCheckpoint,restoreCheckpoint} from './persistence';

const cfg={
 foodRate:2.5,mutation:.12,temperature:.5,maxPopulation:350,
 predatorExtraCost:.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,
 predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:.3,
 predatorMinPreyRatio:7,predatorMetabolismFactor:.3,predatorBirthEnergy:120,
 predatorCatchChance:1,predatorScarcityThreshold:100,preyRefugeWidth:0
};

describe('Genealogy memory cap and checkpoint continuity',()=>{
 it('bounds genealogy while retaining all living ancestors and exactly resumes RNG',()=>{
  const w=new World(404,cfg);
  w.advance(22000);
  expect(w.births).toBeGreaterThan(MAX_LINEAGE);
  expect(w.lineageDropped).toBeGreaterThan(0);
  expect(w.lineage.length).toBeLessThanOrEqual(MAX_LINEAGE+350);
  const ids=new Set(w.lineage.map(a=>a.id));
  expect(w.organisms.every(o=>ids.has(o.id))).toBe(true);
  const checkpoint=createCheckpoint(w);
  const restored=restoreCheckpoint(checkpoint);
  expect(restored.snapshot()).toEqual(w.snapshot());
  for(let i=0;i<500;i++){w.step();restored.step();}
  expect(restored.snapshot()).toEqual(w.snapshot());
  expect(restored.births+32-restored.deaths).toBe(restored.organisms.length);
 },120000);
 it('restores legacy checkpoint lacking a pruning counter',()=>{
  const w=new World(404,cfg);
  const old=createCheckpoint(w);
  delete (old.world as any).lineageDropped;
  const restored=restoreCheckpoint(old);
  expect(restored.lineageDropped).toBe(0);
  expect(restored.organisms.length).toBe(32);
 });
});
