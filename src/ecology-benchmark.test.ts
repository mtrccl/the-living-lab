import {describe,it,expect} from 'vitest';
import {World} from './engine';

// Deterministic, full-engine simulations; never touches the running VM.
// Metrics are compared at equal ticks, not equal wall-clock durations.
const SEEDS=[3001,3011,3019,3023,3037,3041,3049,3061,3067,3079,3083,3089,3109,3119,3121,3137,3163,3167,3181,3187];
const TICKS=20000;
const CASES=[
 {name:'HOLDOUT_20K_ratio7_B105',predatorExtraCost:.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:.3,predatorMinPreyRatio:7,predatorMetabolismFactor:.3,predatorBirthEnergy:105},
 {name:'HOLDOUT_20K_ratio7_B120',predatorExtraCost:.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:.3,predatorMinPreyRatio:7,predatorMetabolismFactor:.3,predatorBirthEnergy:120},
] as const;

describe('Offline multi-seed predator survival benchmark',()=>{
 it('records comparable outcomes without forcing survival',async()=>{
  const results=[] as Array<Record<string,number|string>>;
  for(const testCase of CASES){
   const outcomes=[] as Array<{
     seed:number; survived:number; predators:number; grazers:number;
     firstExtinct:number|null; predatorPeak:number; grazerPeak:number;
     predatorTicks:number; coexistentAt3000:number;coexistentAt5000:number; coexistentAt10000:number; finalMinPrey:number;
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
     predatorMetabolismFactor:testCase.predatorMetabolismFactor,
     predatorBirthEnergy:testCase.predatorBirthEnergy,
    });
    let extinct:number|null=null,predatorPeak=5,grazerPeak=27,predatorTicks=0,coexistentAt3000=0,coexistentAt5000=0,coexistentAt10000=0,finalMinPrey=Infinity;
    for(let tick=1;tick<=TICKS;tick++){
     world.step();
     if(tick%500===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
     const pred=world.organisms.filter(o=>o.species==='predator').length;
     const graze=world.organisms.length-pred;
     predatorPeak=Math.max(predatorPeak,pred);
     grazerPeak=Math.max(grazerPeak,graze);
     predatorTicks+=pred;
     if(tick===3000)coexistentAt3000=Number(pred>0&&graze>0);
     if(tick===5000)coexistentAt5000=Number(pred>0&&graze>0);
     if(tick===10000)coexistentAt10000=Number(pred>0&&graze>0);
     if(tick>=TICKS-2000&&tick%100===0)finalMinPrey=Math.min(finalMinPrey,graze);
     if(extinct===null&&pred===0)extinct=tick;
    }
    const stats=world.stats();
    outcomes.push({seed,survived:stats.predators>0&&stats.grazers>0?1:0,
      predators:stats.predators,grazers:stats.grazers,
      firstExtinct:extinct,predatorPeak,grazerPeak,predatorTicks,coexistentAt3000,coexistentAt5000,coexistentAt10000,finalMinPrey});
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
     coexistAt3000:sum("coexistentAt3000"),
     coexistAt5000:sum("coexistentAt5000"),
     coexistAt10000:sum("coexistentAt10000"),
     averageMinPreyLast2000:sum("finalMinPrey")/SEEDS.length,
   };
   results.push(result);
   console.log('ECOLOGY_BENCHMARK '+JSON.stringify(result));
   console.log('ECOLOGY_SEEDS '+JSON.stringify({case:testCase.name,outcomes}));
  }
  expect(results).toHaveLength(CASES.length);
 },600000);
});
