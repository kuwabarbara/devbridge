import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubClient, GitHubError } from '../lib/github';
const user = (login: string) => ({ login, name: login });
test('bounded public GitHub API snapshot preserves directions, truncation and direct checks; cache avoids requests', async () => {
  const urls: string[] = [];
  const request: typeof fetch = async (input, init) => {
    const url = String(input); urls.push(url);
    assert.equal((init?.headers as Record<string,string>).Authorization, undefined);
    assert.ok(url.startsWith('https://api.github.com/users/'));
    const path = new URL(url).pathname;
    if (path === '/users/alice/following/bob') return new Response(null,{status:204});
    if (path === '/users/bob/following/alice') return new Response(null,{status:404});
    if (path.endsWith('/following')) return Response.json([user('shared')], {headers:{link:'<https://api.github.com/page2>; rel="next"'}});
    if (path.endsWith('/followers')) return Response.json([user('follower')]);
    return Response.json(user(path.split('/').pop()!));
  };
  const client = createGitHubClient(request);
  const data = await client('alice','bob');
  assert.equal(urls.length,8);
  assert.equal(data.truncated,true);
  assert.deepEqual(data.follows,[{source:'alice',target:'shared'},{source:'follower',target:'alice'},{source:'bob',target:'shared'},{source:'follower',target:'bob'},{source:'alice',target:'bob'}]);
  assert.equal(data.developers.length,4);
  assert.deepEqual(await client('ALICE','BOB'),data);
  assert.equal(urls.length,8);
  assert.ok(urls.filter(u=>u.includes('?')).every(u=>u.endsWith('?per_page=100&page=1')));
});
test('invalid IDs, missing users and malformed API data do not yield invented snapshots', async () => {
  let count = 0;
  const client=createGitHubClient(async()=>{count++;return new Response(null,{status:404});});
  await assert.rejects(client('../bad','bob'),(e:unknown)=>e instanceof GitHubError&&e.status===400);
  assert.equal(count,0);
  await assert.rejects(client('missing','bob'),(e:unknown)=>e instanceof GitHubError&&e.status===404);
  const invalid=createGitHubClient(async()=>Response.json({login:'<script>'}));
  await assert.rejects(invalid('alice','bob'),/確認できません/);
});
test('rate and access limits stop requests and expose a retry delay', async () => {
  let calls=0;
  const client=createGitHubClient(async()=>{calls++;return new Response(null,{status:429,headers:{'retry-after':'120'}});},()=>1000);
  for(let i=0;i<2;i++)await assert.rejects(client('alice','bob'),(e:unknown)=>e instanceof GitHubError&&e.status===429&&e.retryAfter===120);
  assert.equal(calls,1);
});
test('remaining=0 stops a snapshot early; no automatic retries on network failures', async () => {
  let calls=0;
  const client=createGitHubClient(async()=>{calls++;return Response.json(user('alice'),{headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'3600'}});},()=>1000);
  await assert.rejects(client('alice','bob'),(e:unknown)=>e instanceof GitHubError&&e.status===429);
  assert.equal(calls,1);
  let failed=0;
  await assert.rejects(createGitHubClient(async()=>{failed++;throw new Error('network');})('alice','bob'),/接続できません/);
  assert.equal(failed,1);
});
test('per-instance hourly budget caps all requests including failures',async()=>{
  let calls=0;
  const client=createGitHubClient(async()=>{calls++;return new Response(null,{status:503});},()=>1000);
  for(let i=0;i<49;i++)await assert.rejects(client('alice','bob'));
  assert.equal(calls,48);
});
