import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,rename,open,copyFile,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {World,createCheckpoint,restoreCheckpoint} from './world-engine.mjs';

const checkpointPath=resolve(process.env.GENESIS_CHECKPOINT??'./data/world.json');
const port=Number(process.env.GENESIS_PORT??8095);
const tickMs=Number(process.env.GENESIS_TICK_MS??100);
const saveMs=Number(process.env.GENESIS_SAVE_MS??60000);
if(!Number.isSafeInteger(port)||port<1||port>65535||!Number.isSafeInteger(tickMs)||tickMs<20||tickMs>60000||!Number.isSafeInteger(saveMs)||saveMs<1000||saveMs>3600000)throw Error('Invalid runner configuration');
const maxBytes=16*1024*1024;
let world;
try{
 const metadata=await stat(checkpointPath);
 if(metadata.size>maxBytes)throw Error('Checkpoint exceeds size limit');
 world=restoreCheckpoint(JSON.parse(await readFile(checkpointPath,'utf8')));
 console.log('Resumed world at tick',world.tick);
}catch(error){
 if(error?.code!=='ENOENT')throw error;
 // A new world is allowed only when no checkpoint exists.
 world=new World(Number(process.env.GENESIS_SEED??42));
 console.log('Created new world');
}
await mkdir(dirname(checkpointPath),{recursive:true});
let saving=Promise.resolve(),stopping=false;
async function save(){
 const serialized=JSON.stringify(createCheckpoint(world));
 if(Buffer.byteLength(serialized)>maxBytes)throw Error('Checkpoint exceeds size limit');
 const tmp=checkpointPath+'.'+randomUUID()+'.tmp';
 const handle=await open(tmp,'wx',0o600);
 try{await handle.writeFile(serialized);await handle.sync();}finally{await handle.close();}
 // Keep one last-known-good checkpoint, without overwriting it with a partial write.
 try{await copyFile(checkpointPath,checkpointPath+'.bak');}catch(error){if(error?.code!=='ENOENT')throw error;}
 await rename(tmp,checkpointPath);
 const dir=await open(dirname(checkpointPath),'r');try{await dir.sync();}finally{await dir.close();}
}
function queueSave(){saving=saving.then(save);saving.catch(error=>{console.error('Checkpoint failed:',error);process.exitCode=1;shutdown();});return saving;}
const server=createServer((req,res)=>{
 if(req.method!=='GET'||(req.url!=='/health'&&req.url!=='/state')){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type','application/json');
 res.setHeader('Cache-Control','no-store');
 const body=req.url==='/health'?{ok:!stopping,tick:world.tick}:{stats:world.stats(),world:world.snapshot()};
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
 try{await queueSave();}catch(error){console.error('Shutdown save failed:',error);process.exitCode=1;}
}
process.on('SIGTERM',()=>{void shutdown();});
process.on('SIGINT',()=>{void shutdown();});
