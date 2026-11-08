import {describe,it,expect} from 'vitest';
import {World} from './engine';

const common={
 foodRate:2.5,mutation:0.12,temperature:0.5,maxPopulation:350,
 predatorExtraCost:.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,
 predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:.3,
 predatorMinPreyRatio:7,predatorMetabolismFactor:.3,predatorBirthEnergy:120
};
const SEEDS=[303,83,42,11,37,101,211,409];
const CASES=[
 {name:'scarcity_50',preyRefugeWidth:0,predatorCatchChance:1,predatorScarcityThreshold:50},
 {name:'scarcity_75',preyRefugeWidth:0,predatorCatchChance:1,predatorScarcityThreshold:75},
 {name:'scarcity_100',preyRefugeWidth:0,predatorCatchChance:1,predatorScarcityThreshold:100},
 {name:'scarcity_75_catch08',preyRefugeWidth:0,predatorCatchChance:.8,predatorScarcityThreshold:75},
] as const;
const HORIZON=40000;

describe('004 ecological structural screening: spatial refuge',()=>{
 it('compares 003 baseline against two prey refuges on identical seeds',async()=>{
  for(const c of CASES){
   const outcomes=[];
   for(const seed of SEEDS){
    const w=new World(seed,{...common,preyRefugeWidth:c.preyRefugeWidth,predatorCatchChance:c.predatorCatchChance,predatorScarcityThreshold:c.predatorScarcityThreshold});
    let firstGrazerExtinction:number|null=null,firstPredatorExtinction:number|null=null;
    let coexistAt20000=0,coexistAt40000=0,coexistAt100000=0,minGrazersLastQuarter=Infinity,maxPredators=0;
    for(let t=1;t<=HORIZON;t++){
     w.step();
     const n=w.stats(),g=n.grazers,p=n.predators;
     if(g===0&&firstGrazerExtinction===null)firstGrazerExtinction=t;
     if(p===0&&firstPredatorExtinction===null)firstPredatorExtinction=t;
     if(t===20000)coexistAt20000=Number(g>0&&p>0);
     if(t===40000)coexistAt40000=Number(g>0&&p>0);
     if(t===100000)coexistAt100000=Number(g>0&&p>0);
     if(t>=75000&&t%500===0)minGrazersLastQuarter=Math.min(minGrazersLastQuarter,g);
     maxPredators=Math.max(maxPredators,p);
     if(t%500===0)await new Promise<void>(r=>setTimeout(r,0));
    }
    outcomes.push({seed,firstGrazerExtinction,firstPredatorExtinction,
     coexistAt20000,coexistAt40000,coexistAt100000,minGrazersLastQuarter,maxPredators,
     grazers:w.stats().grazers,predators:w.stats().predators,
     births:w.births,deaths:w.deaths});
    expect(w.stats().population).toBe(32+w.births-w.deaths);
   }
   console.log('ECOLOGY_004_SCREEN '+JSON.stringify({
    case:c.name,refugeWidth:c.preyRefugeWidth,catchChance:c.predatorCatchChance,scarcityThreshold:c.predatorScarcityThreshold,
    horizon:HORIZON,seeds:SEEDS.length,
    coexistAt20000:outcomes.reduce((a,b)=>a+b.coexistAt20000,0),
    coexistAt40000:outcomes.reduce((a,b)=>a+b.coexistAt40000,0),
    coexistAt100000:outcomes.reduce((a,b)=>a+b.coexistAt100000,0),
    outcomes
   }));
  }
 },900000);
});
