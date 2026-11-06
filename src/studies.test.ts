import {describe,it,expect} from 'vitest';
import {compareEnvironments} from './studies';
describe('controlled paired experiments',()=>{
 it('reproduces paired comparisons exactly',()=>{
  const args=[[42,83,29],150,{foodRate:2},{foodRate:4}] as const;
  expect(compareEnvironments(...args)).toEqual(compareEnvironments(...args));
 });
 it('identical environments yield zero paired effects',()=>{
  const study=compareEnvironments([1,2,3,4],100,{foodRate:3},{foodRate:3});
  expect(study.meanPopulationDifference).toBe(0);
  expect(study.meanSurvivalDifference).toBe(0);
  expect(study.pairs.every(p=>p.populationDifference===0)).toBe(true);
 });
 it('rejects unsafe study sizes and environment values',()=>{
  expect(()=>compareEnvironments([1],100,{},{})).toThrow();
  expect(()=>compareEnvironments([1,2],100,{}, {foodRate:-1})).toThrow();
  expect(()=>compareEnvironments([1,2],100,{maxPopulation:1.5},{})).toThrow();
 });
});
