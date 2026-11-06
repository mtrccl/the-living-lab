import {World} from './engine';
export {World};
export const SCHEMA_VERSION=1;
export function createCheckpoint(world:World){
 return {schemaVersion:SCHEMA_VERSION,savedAt:new Date().toISOString(),world:world.snapshot()};
}
export function restoreCheckpoint(checkpoint:unknown):World{
 if(!checkpoint||typeof checkpoint!=='object')throw Error('Invalid checkpoint');
 const c=checkpoint as Record<string,unknown>;
 if(c.schemaVersion!==SCHEMA_VERSION)throw Error('Unsupported checkpoint schema');
 if(typeof c.savedAt!=='string'||!Number.isFinite(Date.parse(c.savedAt)))throw Error('Invalid checkpoint timestamp');
 return World.restore(c.world);
}
