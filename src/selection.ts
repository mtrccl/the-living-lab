import type {Ancestor,Genome,Species} from './engine';

export type FounderSummary={
 founderId:number;species:Species;descendants:number;livingDescendants:number;
 generations:number;founderGenome:Genome;
};
export type SelectionReport={
 founders:FounderSummary[];
 living:number;historical:number;extinctFounders:number;
 meanFounderSpeed:number;meanLivingSpeed:number;
 meanFounderVision:number;meanLivingVision:number;
};

/** Each ancestor is assigned to its earliest recorded founder. Missing parents form a new root. */
export function analyzeSelection(lineage:readonly Ancestor[]):SelectionReport{
 const byId=new Map(lineage.map(a=>[a.id,a]));
 const founderCache=new Map<number,number>();
 function founderOf(id:number):number{
  const cached=founderCache.get(id);if(cached!==undefined)return cached;
  const path:number[]=[];const visited=new Set<number>();let current=id;
  while(true){
   if(visited.has(current))throw Error('Cyclic lineage');
   visited.add(current);path.push(current);
   const ancestor=byId.get(current);
   if(!ancestor)throw Error('Unknown ancestor');
   if(ancestor.parentId===null||!byId.has(ancestor.parentId))break;
   current=ancestor.parentId;
  }
  for(const node of path)founderCache.set(node,current);
  return current;
 }
 const groups=new Map<number,{descendants:number;livingDescendants:number;generations:number}>();
 for(const a of lineage){
  const root=founderOf(a.id);
  const entry=groups.get(root)??{descendants:0,livingDescendants:0,generations:0};
  if(a.id!==root)entry.descendants++;
  if(a.diedTick===null)entry.livingDescendants++;
  entry.generations=Math.max(entry.generations,a.generation-(byId.get(root)?.generation??0));
  groups.set(root,entry);
 }
 const founders=[...groups].map(([founderId,entry])=>{
  const root=byId.get(founderId)!;
  return{founderId,species:root.species,founderGenome:{...root.genome},...entry};
 }).sort((a,b)=>b.livingDescendants-a.livingDescendants||b.descendants-a.descendants||a.founderId-b.founderId);
 const living=lineage.filter(a=>a.diedTick===null);
 const roots=founders.map(f=>f.founderGenome);
 const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
 return{
  founders,living:living.length,historical:lineage.length,
  extinctFounders:founders.filter(f=>f.livingDescendants===0).length,
  meanFounderSpeed:mean(roots.map(g=>g.speed)),
  meanLivingSpeed:mean(living.map(a=>a.genome.speed)),
  meanFounderVision:mean(roots.map(g=>g.vision)),
  meanLivingVision:mean(living.map(a=>a.genome.vision))
 };
}
