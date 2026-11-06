import {runExperiment,type ExperimentResult} from './experiments';
import {defaults,type Config} from './engine';

export type PairedResult={seed:number;control:ExperimentResult;treatment:ExperimentResult;populationDifference:number;survivalDifference:number};
export type ControlledStudy={
 control:Config;treatment:Config;ticks:number;pairs:PairedResult[];
 meanPopulationDifference:number;meanSurvivalDifference:number;
};
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
/** Matched seeds reduce initial-world differences; this is a simulation comparison, not a causal proof. */
export function compareEnvironments(seeds:readonly number[],ticks:number,control:Partial<Config>,treatment:Partial<Config>):ControlledStudy{
 if(!Array.isArray(seeds)||seeds.length<2||seeds.length>100)throw Error('Expected 2–100 paired seeds');
 const c={...defaults,...control},t={...defaults,...treatment};
 for(const config of [c,t]){
  if(!Number.isFinite(config.foodRate)||config.foodRate<0||config.foodRate>10||
   !Number.isFinite(config.mutation)||config.mutation<0||config.mutation>1||
   !Number.isFinite(config.temperature)||config.temperature<0||config.temperature>1||
   !Number.isSafeInteger(config.maxPopulation)||config.maxPopulation<1||config.maxPopulation>10000)throw Error('Invalid environment');
 }
 const pairs=seeds.map(seed=>{
  const baseline=runExperiment(seed,ticks,c),treated=runExperiment(seed,ticks,t);
  return{seed,control:baseline,treatment:treated,populationDifference:treated.population-baseline.population,survivalDifference:Number(!treated.extinct)-Number(!baseline.extinct)};
 });
 return{control:c,treatment:t,ticks,pairs,
  meanPopulationDifference:mean(pairs.map(p=>p.populationDifference)),
  meanSurvivalDifference:mean(pairs.map(p=>p.survivalDifference))};
}
