import {describe,it,expect} from 'vitest';
import {runExperiment,runBatch} from './experiments';
describe('evolution experiments',()=>{
 it('replays identical seeds and configuration',()=>{
  expect(runExperiment(12,180)).toEqual(runExperiment(12,180));
  expect(runBatch([12,23,34],180)).toEqual(runBatch([12,23,34],180));
 });
 it('reports consistent aggregate population and survival',()=>{
  const result=runBatch([1,2,3],100);
  expect(result.runs).toBe(3);
  expect(result.meanPopulation).toBeCloseTo(result.results.reduce((n,r)=>n+r.population,0)/3);
  expect(result.survivalRate).toBeGreaterThanOrEqual(0);
  expect(result.survivalRate).toBeLessThanOrEqual(1);
  expect(result.results.every(r=>r.predators+r.grazers===r.population)).toBe(true);
 });
 it('measures initial and final trait means',()=>{
  const result=runExperiment(42,0);
  expect(result.finalAverageSpeed).toBe(result.initialAverageSpeed);
  expect(result.finalAverageVision).toBe(result.initialAverageVision);
 });
 it('rejects unbounded batch and simulation inputs',()=>{
  expect(()=>runBatch([],10)).toThrow();
  expect(()=>runBatch(Array.from({length:501},(_,i)=>i),10)).toThrow();
  expect(()=>runExperiment(1,100001)).toThrow();
  expect(()=>runExperiment(-1,10)).toThrow();
 });
});
