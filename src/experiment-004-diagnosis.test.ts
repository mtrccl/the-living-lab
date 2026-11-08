import {describe,it,expect} from 'vitest';
import {World} from './engine';

// Reproduce Experiment 003 exactly before attempting any Experiment 004 tuning.
// No service access, no checkpoint modification, no live-world reset.
const config={
  foodRate:2.5,mutation:0.12,temperature:0.5,maxPopulation:350,
  predatorExtraCost:0.03,predatorCatchRadius:14,predatorSpeedMultiplier:1.5,
  predatorInitialEnergy:115,predatorKillGain:80,grazerAlertMultiplier:0.3,
  predatorMinPreyRatio:7,predatorMetabolismFactor:0.3,predatorBirthEnergy:120
};

describe('004 investigation: Experiment 003 seed-303 retrospective',()=>{
 it('replays the published engine and records extinction and precursors',async()=>{
   const w=new World(303,config);
   const samples:Array<{tick:number;predators:number;grazers:number;food:number;births:number;deaths:number;generation:number}>=[];
   let extinctPredators:number|null=null;
   let extinctGrazers:number|null=null;
   let extinctWorld:number|null=null;
   let foodPeak=0, maxPredators=0, maxGrazers=0;
   for(let tick=1;tick<=40000;tick++){
     w.step();
     const s=w.stats();
     foodPeak=Math.max(foodPeak,s.food);
     maxPredators=Math.max(maxPredators,s.predators);
     maxGrazers=Math.max(maxGrazers,s.grazers);
     if(s.predators===0&&extinctPredators===null)extinctPredators=tick;
     if(s.grazers===0&&extinctGrazers===null)extinctGrazers=tick;
     if(s.population===0&&extinctWorld===null)extinctWorld=tick;
     if(tick%1000===0 || (extinctWorld!==null&&tick===extinctWorld)){
       samples.push({tick,predators:s.predators,grazers:s.grazers,food:s.food,
         births:s.births,deaths:s.deaths,generation:s.generation});
     }
     if(tick%500===0)await new Promise<void>(r=>setTimeout(r,0));
     if(extinctWorld!==null)break;
   }
   const deathsBySpecies=(species:'predator'|'grazer')=>w.lineage
     .filter(a=>a.species===species&&a.diedTick!==null)
     .sort((a,b)=>(b.diedTick??0)-(a.diedTick??0)).slice(0,10)
     .map(a=>({born:a.bornTick,died:a.diedTick,generation:a.generation}));
   console.log('EXPERIMENT_003_REPLAY '+JSON.stringify({
     seed:303,config,extinctPredators,extinctGrazers,extinctWorld,
     foodPeak,maxPredators,maxGrazers,final:w.stats(),samples,
     lastPredatorDeaths:deathsBySpecies('predator'),
     lastGrazerDeaths:deathsBySpecies('grazer')
   }));
   expect(w.stats().population).toBe(32+w.births-w.deaths);
   expect(w.seed).toBe(303);
 },120000);
});
