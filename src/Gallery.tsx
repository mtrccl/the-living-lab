import {useEffect,useState} from 'react';
import type {Genome,Species} from './engine';
export type Discovery={id:string;label:string;tick:number;generation:number;species:Species;genome:Genome;capturedAt:string};
const KEY='genesis:discoveries:v1';
function read():Discovery[]{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'&&x.genome).slice(0,60):[];}catch{return[];}}
export function Gallery({capture}:{capture:()=>Omit<Discovery,'id'|'capturedAt'>|null}){
 const [items,setItems]=useState<Discovery[]>([]);
 useEffect(()=>setItems(read()),[]);
 const persist=(next:Discovery[])=>{try{localStorage.setItem(KEY,JSON.stringify(next));setItems(next);}catch{alert('Browser storage is unavailable.');}};
 const add=()=>{const data=capture();if(!data)return;const item:Discovery={...data,id:crypto.randomUUID(),capturedAt:new Date().toISOString()};persist([item,...items].slice(0,60));};
 const exportGallery=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(items,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='genesis-discoveries.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="panel gallery"><div className="panelhead">07 / GALLERY OF DISCOVERIES <span>{items.length} SAVED</span></div><p>Keep notable organisms in your browser. No uploads or accounts.</p><div className="toolbar"><button onClick={add}>+ SAVE SELECTED ORGANISM</button><button disabled={!items.length} onClick={exportGallery}>↓ EXPORT GALLERY</button><button disabled={!items.length} onClick={()=>{if(confirm('Delete all saved discoveries?'))persist([]);}}>CLEAR</button></div><div className="discovery-grid">{items.map(item=><article className="discovery" key={item.id}><span className="swatch" style={{background:`hsl(${item.genome.hue} 80% 65%)`}}/><div><strong>{item.label}</strong><small>{item.species.toUpperCase()} · GEN {item.generation} · TICK {item.tick}</small><small>SPEED {item.genome.speed.toFixed(2)} · VISION {item.genome.vision.toFixed(0)}</small></div><button aria-label={`Remove ${item.label}`} onClick={()=>persist(items.filter(x=>x.id!==item.id))}>×</button></article>)}</div></section>;
}
