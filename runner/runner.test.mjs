import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';

async function freePort(){
 const server=createServer();
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function start(path,port){
 const child=spawn(process.execPath,['runner/runner.mjs'],{
  env:{...process.env,GENESIS_CHECKPOINT:path,GENESIS_PORT:String(port),GENESIS_TICK_MS:'20',GENESIS_SAVE_MS:'1000',GENESIS_ALLOW_NEW_WORLD:'1'},
  stdio:['ignore','pipe','pipe']
 });
 let output='';
 child.stdout.on('data',d=>{output+=d.toString();});
 child.stderr.on('data',d=>{output+=d.toString();});
 const deadline=Date.now()+8000;
 while(Date.now()<deadline){
  if(child.exitCode!==null)throw Error('Runner exited early: '+output);
  try{
   const response=await fetch('http://127.0.0.1:'+port+'/health');
   if(response.ok)return child;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 child.kill('SIGKILL');
 throw Error('Runner failed to start: '+output);
}
async function stop(child){
 if(child.exitCode!==null)return;
 child.kill('SIGTERM');
 await Promise.race([
  new Promise(resolve=>child.once('exit',resolve)),
  new Promise((_,reject)=>setTimeout(()=>reject(Error('Shutdown timeout')),8000))
 ]);
}
test('runner saves and resumes the same ecosystem; corrupt checkpoints fail closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'genesis-runner-'));
 const path=join(dir,'world.json');
 let child;
 try{
  const port=await freePort();
  child=await start(path,port);
  await new Promise(resolve=>setTimeout(resolve,200));
  const before=await (await fetch('http://127.0.0.1:'+port+'/state')).json();
  assert.ok(before.world.tick>0);
  assert.equal(Object.hasOwn(before.world,'lineage'),false,'telemetry excludes genealogy');
  assert.equal(JSON.parse(await readFile(path,'utf8')).world.seed,42,'first boot checkpoint exists before API serves');
  await stop(child);child=undefined;
  const saved=JSON.parse(await readFile(path,'utf8'));
  assert.ok(saved.world.tick>=before.world.tick);
  assert.equal(saved.world.seed,before.world.seed);
  assert.ok(saved.world.lineage.length>=32,'checkpoint retains genealogy even though API omits it');
  child=await start(path,port);
  const resumed=await (await fetch('http://127.0.0.1:'+port+'/state')).json();
  assert.ok(resumed.world.tick>=saved.world.tick);
  assert.equal(resumed.world.seed,saved.world.seed);
  assert.equal(Object.hasOwn(resumed.world,'lineage'),false);
  await stop(child);child=undefined;
  await copyFile(path,path+'.bak');
  await writeFile(path,'{bad json');
  const failed=spawn(process.execPath,['runner/runner.mjs'],{
   env:{...process.env,GENESIS_CHECKPOINT:path,GENESIS_PORT:String(port)},
   stdio:'ignore'
  });
  const code=await Promise.race([
   new Promise(resolve=>failed.once('exit',resolve)),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('Corrupt checkpoint did not fail closed')),5000))
  ]);
  assert.notEqual(code,0);
  assert.equal(await readFile(path,'utf8'),'{bad json');
  const recovered=spawn(process.execPath,['runner/runner.mjs'],{
   env:{...process.env,GENESIS_CHECKPOINT:path,GENESIS_PORT:String(port),GENESIS_RECOVER_BACKUP:'1',GENESIS_TICK_MS:'20'},stdio:'ignore'
  });
  let healthy=false;
  for(let i=0;i<100;i++){
   try{const r=await fetch('http://127.0.0.1:'+port+'/health');if(r.ok){healthy=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(healthy,'explicit backup recovery starts');
  await stop(recovered);
  const restored=JSON.parse(await readFile(path,'utf8'));
  assert.equal(restored.world.seed,saved.world.seed);
  assert.ok(restored.world.tick>=saved.world.tick);
 }finally{
  if(child&&child.exitCode===null)child.kill('SIGKILL');
  await rm(dir,{recursive:true,force:true});
 }
});

test('missing checkpoint after initialization refuses to reset even with first-boot permission',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'genesis-failclosed-'));
 const path=join(dir,'world.json');
 let child;
 try{
  const port=await freePort();
  child=await start(path,port);
  await stop(child);child=undefined;
  await rm(path);
  const proc=spawn(process.execPath,['runner/runner.mjs'],{
   env:{...process.env,GENESIS_CHECKPOINT:path,GENESIS_PORT:String(port),GENESIS_ALLOW_NEW_WORLD:'1'},
   stdio:'ignore'
  });
  const code=await Promise.race([
   new Promise(resolve=>proc.once('exit',resolve)),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('Missing primary checkpoint did not fail closed')),5000))
  ]);
  assert.notEqual(code,0);
  await assert.rejects(readFile(path,'utf8'),{code:'ENOENT'});
 }finally{if(child&&child.exitCode===null)child.kill('SIGKILL');await rm(dir,{recursive:true,force:true});}
});

test('fresh world refuses implicit creation without explicit opt-in',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'genesis-noautoboot-'));
 const path=join(dir,'world.json');
 try{
  const port=await freePort();
  const proc=spawn(process.execPath,['runner/runner.mjs'],{
   env:{...process.env,GENESIS_CHECKPOINT:path,GENESIS_PORT:String(port),GENESIS_ALLOW_NEW_WORLD:'0'},
   stdio:'ignore'
  });
  const code=await Promise.race([
   new Promise(resolve=>proc.once('exit',resolve)),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('Implicit boot did not fail closed')),5000))
  ]);
  assert.notEqual(code,0);
  await assert.rejects(readFile(path,'utf8'),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
