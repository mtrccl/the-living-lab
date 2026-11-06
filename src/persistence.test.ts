import {describe,it,expect} from 'vitest';
import {World} from './engine';
import {createCheckpoint,restoreCheckpoint} from './persistence';
describe('persistent world checkpoints',()=>{
 it('continues from exactly the saved tick and ancestry',()=>{
  const a=new World(42);a.advance(200);
  const b=restoreCheckpoint(createCheckpoint(a));
  expect(b.tick).toBe(200);
  expect(b.lineage).toEqual(a.lineage);
  a.advance(100);b.advance(100);
  expect(b.snapshot()).toEqual(a.snapshot());
 });
 it('rejects unknown schema, corrupt payloads and invalid timestamps',()=>{
  const checkpoint=createCheckpoint(new World(42));
  expect(()=>restoreCheckpoint({...checkpoint,schemaVersion:2})).toThrow();
  expect(()=>restoreCheckpoint({...checkpoint,world:null})).toThrow();
  expect(()=>restoreCheckpoint({...checkpoint,savedAt:'bad'})).toThrow();
 });
});
