import {describe,it,expect} from 'vitest';
import {World} from './engine';

// Deterministic, full-engine simulations; never touches the running VM.
// Metrics are compared at equal ticks, not equal wall-clock durations.
const SEEDS=[11,23,37,42,83,101,211,307,409,503];
const TICKS=3000;
const CASES=[
 {name:'density_3',predatorExtraCost:.05,predatorCatchRadius:16,predatorSpeedMultiplier:1.4,predatorInitialEnergy:110,predatorKillGain:75,grazerAlertMultiplier:.6,predatorMinPreyRatio:3},
 {name:'density_5',predatorExtraCost:.05,predatorCatchRadius:16,predatorSpeedMultiplier:1.4,predatorInitialEnergy:110,predatorKillGain:75,grazerAlertMultiplier:.6,predatorMinPreyRatio:5},
 {name:'density_8',predatorExtraCost:.05,predatorCatchRadius:16,predatorSpeedMultiplier:1.4,predatorInitialEnergy:110,predatorKillGain:75,grazerAlertMultiplier:.6,predatorMinPreyRatio:8},
 {name:'density_12',predatorExtraCost:.05,predatorCatchRadius:16,predatorSpeedMultiplier:1.4,predatorInitialEnergy:110,predatorKillGain:75,grazerAlertMultiplier:.6,predatorMinPreyRatio:12},
 {name:'density_6_hunt12',predatorExtraCost:.02,predatorCatchRadius:12,predatorSpeedMultiplier:1.6,predatorInitialEnergy:120,predatorKillGain:75,grazerAlertMultiplier:.5,predatorMinPreyRatio:6},
 {name:'density_8_hunt20',predatorExtraCost:.02,predatorCatchRadius:20,predatorSpeedMultiplier:1.6,predatorInitialEnergy:120,predatorKillGain:85,grazerAlertMultiplier:.5,predatorMinPreyRatio:8},
 {name:'density_5_lowalert',predatorExtraCost:.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:.3,predatorMinPreyRatio:5},
 {name:'density_10_lowalert',predatorExtraCost:.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:.3,predatorMinPreyRatio:10},
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
     predatorSpeedMultiplier:testCase.predatorSpeedMultiplier,
     predatorInitialEnergy:testCase.predatorInitialEnergy,
     predatorKillGain:testCase.predatorKillGain,
     grazerAlertMultiplier:testCase.grazerAlertMultiplier,
     predatorMinPreyRatio:testCase.predatorMinPreyRatio,
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
