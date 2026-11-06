import {describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

describe('Experiment 003 deployment preparation',()=>{
 it('has valid Bash syntax',()=>{
  expect(()=>execFileSync('bash',['-n','ops/start-experiment-003.sh'])).not.toThrow();
 });
 it('compiles the actual engine with built-in TypeScript stripper',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'genesis-003-'));
  try{
   for(const name of ['behavior','engine','persistence']){
    copyFileSync(resolve('src',name+'.ts'),join(dir,name+'.ts'));
   }
   execFileSync(process.execPath,['ops/build-003.mjs',dir],{stdio:'pipe'});
   const m=await import(pathToFileURL(join(dir,'persistence.mjs')).href);
   const w=new m.World(303,{predatorMetabolismFactor:.3,predatorMinPreyRatio:7,predatorBirthEnergy:120});
   w.advance(150);
   const restored=m.restoreCheckpoint(m.createCheckpoint(w));
   expect(restored.snapshot()).toEqual(w.snapshot());
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
