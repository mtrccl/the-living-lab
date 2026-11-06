// Compiles the reviewed Genesis TypeScript engine into standalone .mjs modules.
// Uses the Node 22 built-in TypeScript stripper; does not need npm or network.
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2];
if(!dir)throw Error('Usage: node build-003.mjs DIRECTORY');
for(const name of ['behavior','engine','persistence']){
 let source=readFileSync(join(dir,name+'.ts'),'utf8');
 source=source.replaceAll("from './behavior'","from './behavior.mjs'")
              .replaceAll("from './engine'","from './engine.mjs'");
 const compiled=stripTypeScriptTypes(source,{mode:'strip'});
 writeFileSync(join(dir,name+'.mjs'),compiled,{mode:0o644});
}
writeFileSync(join(dir,'world-engine.mjs'),
 "export {World,createCheckpoint,restoreCheckpoint} from './persistence.mjs';\n",
 {mode:0o644});
console.log('Compiled Genesis experiment 003 modules.');
