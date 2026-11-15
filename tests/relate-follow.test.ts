import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { RelateDb } from '@relate/relate-wasm';
import { searchFollows } from '../lib/relate-follow';
import type { GitHubSnapshot } from '../lib/github-types';
const person=(login:string)=>({login,name:null,url:`https://github.com/${login}`});
before(async()=>{await init({module_or_path:await readFile(new URL('../node_modules/@relate/relate-wasm/relate_bg.wasm',import.meta.url))});});
function sample():GitHubSnapshot{return {profiles:[person('alice'),person('bob')],developers:['alice','bob','following','follower','bridge','far','other'].map(person),follows:[{source:'alice',target:'bob'},{source:'alice',target:'following'},{source:'bob',target:'following'},{source:'follower',target:'alice'},{source:'follower',target:'bob'},{source:'alice',target:'bridge'},{source:'bridge',target:'bob'},{source:'alice',target:'far'},{source:'far',target:'other'},{source:'other',target:'bob'}],fetchedAt:'2026-11-16T00:00:00Z',truncated:false,remaining:50};}
test('actual Relate WASM finds direct, common following/followers and two-hop contacts, excludes three-hop paths',()=>{
 const db=new RelateDb();try{const result=searchFollows(db,sample());assert.equal(result.directCount,1);assert.equal(result.commonCount,3);assert.deepEqual(result.nodes.slice(2).map(n=>n.id),['bridge','follower','following']);assert.equal(result.edges.length,7);assert.ok(result.edges.some(e=>e.source==='follower'&&e.target==='alice'));assert.ok(!result.edges.some(e=>e.source==='bob'&&e.target==='alice'));}finally{db.free();}
});
test('actual Relate WASM returns no synthetic relationships for empty or disconnected data',()=>{
 const db=new RelateDb();try{const data=sample();data.follows=[];const result=searchFollows(db,data);assert.equal(result.directCount,0);assert.equal(result.commonCount,0);assert.equal(result.nodes.length,2);assert.deepEqual(result.edges,[]);}finally{db.free();}
});
test('common-contact display is bounded without hiding the full count',()=>{
 const db=new RelateDb();try{const data=sample();data.follows=[];for(let i=0;i<12;i++){const login=`contact${i}`;data.developers.push(person(login));data.follows.push({source:'alice',target:login},{source:login,target:'bob'});}const result=searchFollows(db,data);assert.equal(result.commonCount,12);assert.equal(result.shownContacts,8);assert.equal(result.nodes.length,10);assert.equal(result.edges.length,16);}finally{db.free();}
});
test('GitHub response transport -> normalized snapshot -> real Relate search integrates without fabricated links',async()=>{
 const {createGitHubClient}=await import('../lib/github');
 const client=createGitHubClient(async(input)=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith('/following/bob'))return new Response(null,{status:204});
  if(path.endsWith('/following/alice'))return new Response(null,{status:404});
  if(path.endsWith('/following'))return Response.json([{login:'contact'}]);
  if(path.endsWith('/followers'))return Response.json([]);
  return Response.json({login:path.split('/').pop(),name:'Public profile'});
 });
 const snapshot=await client('alice','bob');const db=new RelateDb();
 try{const result=searchFollows(db,snapshot);assert.equal(result.directCount,1);assert.equal(result.commonCount,1);assert.equal(result.edges.length,3);}finally{db.free();}
});
