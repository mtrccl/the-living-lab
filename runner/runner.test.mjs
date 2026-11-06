import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
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
  env:{...process.env,GENESIS_CHECKPOINT:path,GENESIS_PORT:String(port),GENESIS_TICK_MS:'20',GENESIS_SAVE_MS:'1000'},
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
  await stop(child);child=undefined;
  const saved=JSON.parse(await readFile(path,'utf8'));
  assert.ok(saved.world.tick>=before.world.tick);
  assert.equal(saved.world.seed,before.world.seed);
  assert.ok(saved.world.lineage.length>=before.world.lineage.length);
  child=await start(path,port);
  const resumed=await (await fetch('http://127.0.0.1:'+port+'/state')).json();
  assert.ok(resumed.world.tick>=saved.world.tick);
  assert.equal(resumed.world.seed,saved.world.seed);
  assert.ok(resumed.world.lineage.length>=saved.world.lineage.length);
  await stop(child);child=undefined;
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
 }finally{
  if(child&&child.exitCode===null)child.kill('SIGKILL');
  await rm(dir,{recursive:true,force:true});
 }
});
