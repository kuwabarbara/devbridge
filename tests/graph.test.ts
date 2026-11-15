import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGraph, validateIds } from '../lib/graph';
test('validates GitHub IDs and rejects identical endpoints',()=>{
 for (const id of ['a','torvalds','a-b','a'.repeat(39)]) assert.equal(validateIds(id,'other'),null);
 for (const id of ['','-abc','abc-','a--b','abc def','a'.repeat(40),'日本語']) assert.ok(validateIds(id,'other'));
 assert.ok(validateIds('User','user'));
});
test('demo graph preserves endpoints and has two connected routes',()=>{
 const {nodes,edges}=createDemoGraph('alice','bob');
 assert.equal(nodes.find(n=>n.id==='start')?.label,'alice');
 assert.equal(nodes.find(n=>n.id==='end')?.label,'bob');
 assert.ok(edges.every(e=>nodes.some(n=>n.id===e.source)&&nodes.some(n=>n.id===e.target)));
 function paths(id:string):number[]{if(id==='end')return [0];return edges.filter(e=>e.source===id).flatMap(e=>paths(e.target).map(n=>n+1));}
 assert.deepEqual(paths('start').sort(),[2,3]);
 assert.equal(nodes.filter(n=>n.kind==='user').length,3);
});
