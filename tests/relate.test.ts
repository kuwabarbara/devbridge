import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { RelateDb } from '@relate/relate-wasm';
import { execute, seedDemo, queryDemo, QUERIES } from '../lib/relate-demo';

before(async () => {
  // Real published WASM bytes, not a mock or ordinary Neo4j connection.
  const bytes = await readFile(new URL('../node_modules/@relate/relate-wasm/relate_bg.wasm', import.meta.url));
  await init({ module_or_path: bytes });
});
test('Relate WASM creates data and executes follow and collaboration Cypher', () => {
  const db = new RelateDb();
  try {
    const seeded = seedDemo(db);
    assert.equal(seeded[0].stats.nodes_created, 3);
    assert.equal(seeded[1].stats.relationships_created, 1);
    assert.equal(seeded[2].stats.relationships_created, 2);
    const result = queryDemo(db);
    assert.deepEqual(result.follows.rows, [{ source: 'alice', target: 'bob' }]);
    assert.deepEqual(result.collaboration.rows, [{ source: 'alice', repository: 'devbridge', target: 'bob' }]);
    assert.ok(result.collaboration.elapsed_ms >= 0);
    assert.deepEqual(execute(db, QUERIES.collaboration, { from: 'missing', to: 'bob' }).rows, []);
    assert.deepEqual(execute(db, QUERIES.collaboration, { from: "alice' OR true //", to: 'bob' }).rows, []);
    execute(db, "MATCH ()-[r:FOLLOWS]->() DELETE r");
    assert.deepEqual(queryDemo(db).follows.rows, []);
  } finally { db.free(); }
});
test('Relate surfaces syntax errors and fresh databases have no persisted data', () => {
  const db = new RelateDb();
  try {
    assert.deepEqual(queryDemo(db).follows.rows, []);
    assert.throws(() => execute(db, 'THIS IS NOT CYPHER'));
  } finally { db.free(); }
});
