import {World,defaults,type Config} from './engine';

export type ExperimentResult={
 seed:number; ticks:number; population:number; predators:number; grazers:number;
 births:number; deaths:number; generation:number; averageEnergy:number;
 initialAverageSpeed:number; finalAverageSpeed:number;
 initialAverageVision:number; finalAverageVision:number;
 extinct:boolean;
};
export type ExperimentSummary={
 runs:number; ticksPerRun:number; survivalRate:number;
 meanPopulation:number; meanGeneration:number;
 meanSpeedChange:number; meanVisionChange:number;
 results:ExperimentResult[];
};
const mean=(values:number[])=>values.length?values.reduce((sum,n)=>sum+n,0)/values.length:0;
const trait=(world:World,key:'speed'|'vision')=>mean(world.organisms.map(o=>o.genome[key]));

export function runExperiment(seed:number,ticks:number,config:Partial<Config>={}):ExperimentResult{
 if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid seed');
 if(!Number.isSafeInteger(ticks)||ticks<0||ticks>100000)throw Error('Invalid tick count');
 const world=new World(seed,{...defaults,...config});
 const initialAverageSpeed=trait(world,'speed');
 const initialAverageVision=trait(world,'vision');
 world.advance(ticks);
 const stats=world.stats();
 return {
  seed,ticks,population:stats.population,predators:stats.predators,grazers:stats.grazers,
  births:stats.births,deaths:stats.deaths,generation:stats.generation,
  averageEnergy:stats.averageEnergy,
  initialAverageSpeed,finalAverageSpeed:trait(world,'speed'),
  initialAverageVision,finalAverageVision:trait(world,'vision'),
  extinct:stats.population===0
 };
}

export function runBatch(seeds:readonly number[],ticks:number,config:Partial<Config>={}):ExperimentSummary{
 if(!Array.isArray(seeds)||seeds.length<1||seeds.length>500)throw Error('Expected 1–500 seeds');
 const results=seeds.map(seed=>runExperiment(seed,ticks,config));
 return {
  runs:results.length,ticksPerRun:ticks,
  survivalRate:mean(results.map(r=>r.extinct?0:1)),
  meanPopulation:mean(results.map(r=>r.population)),
  meanGeneration:mean(results.map(r=>r.generation)),
  meanSpeedChange:mean(results.map(r=>r.finalAverageSpeed-r.initialAverageSpeed)),
  meanVisionChange:mean(results.map(r=>r.finalAverageVision-r.initialAverageVision)),
  results
 };
}
