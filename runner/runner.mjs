import {createServer} from 'node:http';
import {mkdir,readFile,rename,open,copyFile,stat,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {World,createCheckpoint,restoreCheckpoint} from './world-engine.mjs';

const checkpointPath=resolve(process.env.GENESIS_CHECKPOINT??'./data/world.json');
const port=Number(process.env.GENESIS_PORT??8095);
const tickMs=Number(process.env.GENESIS_TICK_MS??100);
const saveMs=Number(process.env.GENESIS_SAVE_MS??60000);
if(!Number.isSafeInteger(port)||port<1||port>65535||!Number.isSafeInteger(tickMs)||tickMs<20||tickMs>60000||!Number.isSafeInteger(saveMs)||saveMs<1000||saveMs>86400000)throw Error('Invalid runner configuration');
const maxBytes=16*1024*1024;
const recovery=process.env.GENESIS_RECOVER_BACKUP==='1';
async function load(path){const metadata=await stat(path);if(metadata.size>maxBytes)throw Error('Checkpoint exceeds size limit');return restoreCheckpoint(JSON.parse(await readFile(path,'utf8')));}

const initializedMarker=checkpointPath+'.initialized';
let world,firstBoot=false;
try{
 world=await load(checkpointPath);
 console.log('Resumed world at tick',world.tick);
}catch(error){
 if(recovery){
  try{world=await load(checkpointPath+'.bak');console.log('Recovered backup at tick',world.tick);}catch(backupError){throw new AggregateError([error,backupError],'Primary and backup checkpoints unusable');}
 }else{
  if(error?.code!=='ENOENT')throw error;
  // Missing primary with a surviving backup is not a new installation.
  try{await stat(checkpointPath+'.bak');throw Error('Primary checkpoint missing; backup exists. Set GENESIS_RECOVER_BACKUP=1 for explicit recovery.');}
  catch(backupError){if(backupError?.code!=='ENOENT')throw backupError;}
  // A missing checkpoint must NEVER silently create a new world after a crash.
  try{await stat(initializedMarker);throw Error('Previously initialized world has no checkpoint: refusing reset.');}
  catch(markerError){if(markerError?.code!=='ENOENT')throw markerError;}
  if(process.env.GENESIS_ALLOW_NEW_WORLD!=='1')throw Error('No checkpoint; explicit GENESIS_ALLOW_NEW_WORLD=1 required for first boot');
  const seed=Number(process.env.GENESIS_SEED??42);
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid Genesis seed');
  let config={};
  if(process.env.GENESIS_CONFIG){
   const parsed=JSON.parse(process.env.GENESIS_CONFIG);
   if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))throw Error('GENESIS_CONFIG must be an object');
   const known={foodRate:[0,10],mutation:[0,1],temperature:[0,1],maxPopulation:[1,10000],predatorExtraCost:[0,1],predatorCatchRadius:[1,50],predatorSpeedMultiplier:[0.5,4],predatorInitialEnergy:[40,145],predatorKillGain:[0,200],grazerAlertMultiplier:[0.1,2],predatorMinPreyRatio:[0,100],predatorMetabolismFactor:[0.05,2],predatorBirthEnergy:[60,145],preyRefugeWidth:[0,450],predatorCatchChance:[0,1],predatorScarcityThreshold:[0,500]};
   for(const [key,value] of Object.entries(parsed)){
    if(!(key in known)||typeof value!=='number'||!Number.isFinite(value)||value<known[key][0]||value>known[key][1])throw Error('Invalid GENESIS_CONFIG field: '+key);
   }
   if(parsed.maxPopulation!==undefined&&!Number.isSafeInteger(parsed.maxPopulation))throw Error('maxPopulation must be an integer');
   config=parsed;
  }
  world=new World(seed,config);
  firstBoot=true;
  console.log('Initialized new world; checkpoint required before serving');
 }
}
await mkdir(dirname(checkpointPath),{recursive:true});
let saving=Promise.resolve(),stopping=false,failed=false;
async function save(){
 const serialized=JSON.stringify(createCheckpoint(world));
 if(Buffer.byteLength(serialized)>maxBytes)throw Error('Checkpoint exceeds size limit');
 const tmp=checkpointPath+'.'+randomUUID()+'.tmp';
 try{
  const handle=await open(tmp,'wx',0o600);
  try{await handle.writeFile(serialized);await handle.sync();}finally{await handle.close();}
  // Never replace a good backup with a corrupt primary during explicit recovery.
  if(!recovery){try{await copyFile(checkpointPath,checkpointPath+'.bak');}catch(error){if(error?.code!=='ENOENT')throw error;}}
  await rename(tmp,checkpointPath);
 }finally{await unlink(tmp).catch(error=>{if(error?.code!=='ENOENT')throw error;});}
 const dir=await open(dirname(checkpointPath),'r');try{await dir.sync();}finally{await dir.close();}
}
function queueSave(){saving=saving.then(save);saving.catch(error=>{console.error('Checkpoint failed:',error);failed=true;process.exitCode=1;void shutdown();});return saving;}
// First-ever world is durably saved before the first tick or API request.
if(firstBoot)await save();
// Older checkpoints are also marked as initialized on their first resumed boot.
try{const {writeFile}=await import('node:fs/promises');await writeFile(initializedMarker,'initialized\n',{flag:'wx',mode:0o600});}
catch(error){if(error?.code!=='EEXIST')throw error;}
const server=createServer((req,res)=>{
 if(req.method!=='GET'||(req.url!=='/health'&&req.url!=='/state')){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type','application/json');
 res.setHeader('Cache-Control','no-store');
 const body=req.url==='/health'?{ok:!stopping,tick:world.tick}:(()=>{const state=world.snapshot();delete state.lineage;return{stats:world.stats(),world:state};})();
 const payload=JSON.stringify(body);
 if(Buffer.byteLength(payload)>maxBytes){res.writeHead(503);res.end(JSON.stringify({error:'State too large'}));return;}
 res.end(payload);
});
server.listen(port,'127.0.0.1',()=>console.log('Genesis runner listening on 127.0.0.1:'+port));
const ticker=setInterval(()=>{if(!stopping)world.step();},tickMs);
const saver=setInterval(()=>{if(!stopping)void queueSave();},saveMs);
async function shutdown(){
 if(stopping)return;stopping=true;clearInterval(ticker);clearInterval(saver);
 server.close();
 if(!failed){try{await queueSave();}catch(error){console.error('Shutdown save failed:',error);process.exitCode=1;}}
 if(process.exitCode)process.exit(process.exitCode);
}
process.on('SIGTERM',()=>{void shutdown();});
process.on('SIGINT',()=>{void shutdown();});
