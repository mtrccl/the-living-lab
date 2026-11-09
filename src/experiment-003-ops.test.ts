import {describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';

describe('Experiment 003 deployment preparation',()=>{
 it('has valid Bash syntax',()=>{
  expect(()=>execFileSync('bash',['-n','ops/start-experiment-003.sh'])).not.toThrow();
 });
 it('validates Experiment 004 startup shell syntax',()=>{
  expect(()=>execFileSync('bash',['-n','ops/start-experiment-004.sh'])).not.toThrow();
 });
 it('syntax-checks the stopped-only Genesis safety installer',()=>{
  expect(()=>execFileSync('bash',['-n','ops/install-genesis-safety.sh'])).not.toThrow();
 });
 it('validates closing script syntax',()=>{
  expect(()=>execFileSync('bash',['-n','ops/close-experiment-003.sh'])).not.toThrow();
 });
 it('compiles the actual engine with built-in TypeScript stripper',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'genesis-003-'));
  try{
   for(const name of ['behavior','engine','persistence']){
    copyFileSync(resolve('src',name+'.ts'),join(dir,name+'.ts'));
   }
   execFileSync(process.execPath,['ops/build-003.mjs',dir],{stdio:'pipe'});
   const smoke=`
    import {World,createCheckpoint,restoreCheckpoint} from '${join(dir,'persistence.mjs')}';
    const w=new World(303,{predatorMetabolismFactor:.3,predatorMinPreyRatio:7,predatorBirthEnergy:120});
    w.advance(150);
    const restored=restoreCheckpoint(createCheckpoint(w));
    if(JSON.stringify(restored.snapshot())!==JSON.stringify(w.snapshot()))process.exit(1);
    console.log('STAGING_SMOKE_OK');
   `;
   const output=execFileSync(process.execPath,['--input-type=module','-e',smoke],{encoding:'utf8'});
   expect(output).toContain('STAGING_SMOKE_OK');
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
