import {describe,it,expect} from 'vitest';
import {World} from './engine';

// Deterministic, full-engine simulations; never touches the running VM.
// Metrics are compared at equal ticks, not equal wall-clock durations.
const SEEDS=[11,23,37,42,83,101,211,307,409,503];
const TICKS=3000;
const CASES=[
 {name:'baseline',predatorExtraCost:.16,predatorCatchRadius:8},
 {name:'cost_005',predatorExtraCost:.05,predatorCatchRadius:8},
 {name:'radius_12',predatorExtraCost:.16,predatorCatchRadius:12},
 {name:'cost_005_radius_12',predatorExtraCost:.05,predatorCatchRadius:12},
 {name:'cost_000_radius_14',predatorExtraCost:0,predatorCatchRadius:14},
] as const;

describe('Offline multi-seed predator survival benchmark',()=>{
 it('records comparable outcomes without forcing survival',()=>{
  const results=[] as Array<Record<string,number|string>>;
  for(const testCase of CASES){
   const outcomes=[] as Array<{
     seed:number; survived:number; predators:number; grazers:number;
     firstExtinct:number|null; predatorPeak:number; grazerPeak:number;
     predatorTicks:number;
   }>;
   for(const seed of SEEDS){
    const world=new World(seed,{
     predatorExtraCost:testCase.predatorExtraCost,
     predatorCatchRadius:testCase.predatorCatchRadius,
    });
    let extinct:number|null=null,predatorPeak=5,grazerPeak=27,predatorTicks=0;
    for(let tick=1;tick<=TICKS;tick++){
     world.step();
     const pred=world.organisms.filter(o=>o.species==='predator').length;
     const graze=world.organisms.length-pred;
     predatorPeak=Math.max(predatorPeak,pred);
     grazerPeak=Math.max(grazerPeak,graze);
     predatorTicks+=pred;
     if(extinct===null&&pred===0)extinct=tick;
    }
    const stats=world.stats();
    outcomes.push({seed,survived:stats.predators>0?1:0,
      predators:stats.predators,grazers:stats.grazers,
      firstExtinct:extinct,predatorPeak,grazerPeak,predatorTicks});
   }
   const sum=(key:keyof typeof outcomes[number])=>outcomes.reduce((a,o)=>a+Number(o[key]??0),0);
   const alive=sum('survived');
   const result={
     case:testCase.name,seeds:SEEDS.length,ticks:TICKS,
     survivors:alive,
     totalPredatorsAtEnd:sum('predators'),
     averagePredatorsAtEnd:sum('predators')/SEEDS.length,
     averageGrazersAtEnd:sum('grazers')/SEEDS.length,
     averagePredatorTicks:sum('predatorTicks')/SEEDS.length,
     maxPredatorPeak:Math.max(...outcomes.map(o=>o.predatorPeak)),
     extinctByEnd:SEEDS.length-alive,
   };
   results.push(result);
   console.log('ECOLOGY_BENCHMARK '+JSON.stringify(result));
   console.log('ECOLOGY_SEEDS '+JSON.stringify({case:testCase.name,outcomes}));
  }
  expect(results).toHaveLength(CASES.length);
 },180000);
});
