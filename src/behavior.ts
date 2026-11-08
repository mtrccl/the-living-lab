import type {Organism,Food} from './engine';
export type Steering={x:number;y:number;mode:'flee'|'forage'|'hunt'|'wander'};
const distance2=(a:{x:number;y:number},b:{x:number;y:number})=>(a.x-b.x)**2+(a.y-b.y)**2;
/** Deterministic priority: imminent threat, visible food/prey, then caller-supplied wandering. */
export function chooseSteering(o:Organism,organisms:readonly Organism[],food:readonly Food[],wanderAngle:number,grazerAlertMultiplier=1,preyRefugeWidth=0):Steering{
 const radius2=o.genome.vision**2;
 if(o.species==='grazer'){
  let threat:Organism|undefined,nearest=radius2*grazerAlertMultiplier**2;
  for(const other of organisms){
   if(other.species!=='predator'||other.energy<=0)continue;
   const d=distance2(o,other);
   if(d<nearest){nearest=d;threat=other;}
  }
  if(threat){
   const dx=o.x-threat.x,dy=o.y-threat.y;
   const angle=dx===0&&dy===0?wanderAngle:Math.atan2(dy,dx);
   return{x:Math.cos(angle),y:Math.sin(angle),mode:'flee'};
  }
  let target:Food|undefined;nearest=radius2;
  for(const f of food){const d=distance2(o,f);if(d<nearest){nearest=d;target=f;}}
  if(target){const a=Math.atan2(target.y-o.y,target.x-o.x);return{x:Math.cos(a),y:Math.sin(a),mode:'forage'};}
 }else{
  let prey:Organism|undefined,nearest=radius2;
  for(const other of organisms){
   if(other.species!=='grazer'||other.energy<=0||other.x<preyRefugeWidth)continue;
   const d=distance2(o,other);
   if(d<nearest){nearest=d;prey=other;}
  }
  if(prey){const a=Math.atan2(prey.y-o.y,prey.x-o.x);return{x:Math.cos(a),y:Math.sin(a),mode:'hunt'};}
 }
 return{x:Math.cos(wanderAngle),y:Math.sin(wanderAngle),mode:'wander'};
}
