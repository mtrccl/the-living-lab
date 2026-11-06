export type Genome={speed:number;vision:number;efficiency:number;hue:number};
export type Species='grazer'|'predator';
export type Biome='fertile'|'arid'|'extreme';
export function biomeAt(x:number,y:number):Biome { if(x<300)return 'fertile';if(x<600)return 'arid';return 'extreme'; }
export function biomeCost(b:Biome):number{return b==='fertile'?0:b==='arid'?.13:.32;}
export type Organism={id:number;x:number;y:number;energy:number;age:number;generation:number;genome:Genome;species:Species;parentId:number|null};
export type Food={x:number;y:number};
export type Config={foodRate:number;mutation:number;temperature:number;maxPopulation:number};
export const defaults:Config={foodRate:2.5,mutation:0.12,temperature:0.5,maxPopulation:350};
export const WIDTH=900,HEIGHT=540;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export class World{
 seed:number;rng:number;tick=0;nextId=1;births=0;deaths=0;organisms:Organism[]=[];food:Food[]=[];config:Config;
 constructor(seed=42,config:Partial<Config>={}){this.seed=seed>>>0;this.rng=this.seed||1;this.config={...defaults,...config};for(let i=0;i<32;i++)this.organisms.push(this.spawn(undefined,undefined,undefined,0,i%7===0?'predator':'grazer'));for(let i=0;i<140;i++)this.food.push(this.newFood());}
 random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
 newFood():Food{return{x:this.random()*WIDTH,y:this.random()*HEIGHT};}
 spawn(x=this.random()*WIDTH,y=this.random()*HEIGHT,genome?:Genome,generation=0,species:Species='grazer',parentId:number|null=null):Organism{return{id:this.nextId++,x,y,energy:species==='predator'?90:65,age:0,generation,species,parentId,genome:genome??{speed:0.5+this.random(),vision:25+this.random()*75,efficiency:0.5+this.random(),hue:this.random()*360}};}
 mutate(g:Genome):Genome{const m=(v:number,scale:number,a:number,b:number)=>clamp(v+(this.random()*2-1)*scale*this.config.mutation,a,b);return{speed:m(g.speed,1,.2,2.5),vision:m(g.vision,65,10,160),efficiency:m(g.efficiency,1,.2,2),hue:(g.hue+(this.random()*2-1)*80*this.config.mutation+360)%360};}
 step(){this.tick++;const born:Organism[]=[];for(const o of this.organisms){if(o.energy<=0)continue;o.age++;let target:Food|undefined;let best=o.genome.vision**2;if(o.species==='grazer')for(const f of this.food){const d=(o.x-f.x)**2+(o.y-f.y)**2;if(d<best){best=d;target=f;}}
 let prey:Organism|undefined;if(o.species==='predator')for(const p of this.organisms){if(p===o||p.species!=='grazer'||p.energy<=0)continue;const d=(o.x-p.x)**2+(o.y-p.y)**2;if(d<best){best=d;prey=p;}}
 const angle=prey?Math.atan2(prey.y-o.y,prey.x-o.x):target?Math.atan2(target.y-o.y,target.x-o.x):this.random()*Math.PI*2;const speed=o.genome.speed*1.7;o.x=clamp(o.x+Math.cos(angle)*speed,0,WIDTH);o.y=clamp(o.y+Math.sin(angle)*speed,0,HEIGHT);o.energy-=.17+speed*.09/o.genome.efficiency+Math.abs(this.config.temperature-.5)*.27+biomeCost(biomeAt(o.x,o.y))+(o.species==='predator'?.16:0);
 if(prey&&prey.energy>0&&(o.x-prey.x)**2+(o.y-prey.y)**2<64){prey.energy=0;o.energy=Math.min(145,o.energy+65);}
 if(target&&(o.x-target.x)**2+(o.y-target.y)**2<49){const i=this.food.indexOf(target);if(i>=0){this.food.splice(i,1);o.energy=Math.min(145,o.energy+32);}}
 if(o.energy>105&&this.organisms.length+born.length<this.config.maxPopulation){o.energy*=.52;const child=this.spawn(clamp(o.x+(this.random()-.5)*16,0,WIDTH),clamp(o.y+(this.random()-.5)*16,0,HEIGHT),this.mutate(o.genome),o.generation+1,o.species,o.id);child.energy=o.energy;born.push(child);this.births++;}}
 const n=this.organisms.length;this.organisms=this.organisms.filter(o=>o.energy>0&&o.age<2400);this.deaths+=n-this.organisms.length;this.organisms.push(...born);
 const count=Math.floor(this.config.foodRate)+(this.random()<this.config.foodRate%1?1:0);for(let i=0;i<count&&this.food.length<750;i++){const f=this.newFood();if(biomeAt(f.x,f.y)==='fertile'||this.random()<(biomeAt(f.x,f.y)==='arid'?.45:.15))this.food.push(f);}}
 advance(n:number){for(let i=0;i<n;i++)this.step();}
 stats(){const n=this.organisms.length;return{tick:this.tick,population:n,food:this.food.length,births:this.births,deaths:this.deaths,averageEnergy:n?this.organisms.reduce((a,o)=>a+o.energy,0)/n:0,generation:n?Math.max(...this.organisms.map(o=>o.generation)):0,predators:this.organisms.filter(o=>o.species==='predator').length,grazers:this.organisms.filter(o=>o.species==='grazer').length};}
 snapshot(){return JSON.parse(JSON.stringify({seed:this.seed,rng:this.rng,tick:this.tick,nextId:this.nextId,births:this.births,deaths:this.deaths,organisms:this.organisms,food:this.food,config:this.config}));}
 static restore(s:ReturnType<World['snapshot']>):World{if(!s||!Array.isArray(s.organisms)||!Array.isArray(s.food)||s.organisms.length>10000||s.food.length>10000||!s.config||!Number.isFinite(s.rng))throw Error('Invalid snapshot');const w=Object.create(World.prototype) as World;Object.assign(w,JSON.parse(JSON.stringify(s)));for(const o of w.organisms){o.species=o.species==='predator'?'predator':'grazer';o.parentId??=null;}w.config={...defaults,...s.config};return w;}
}