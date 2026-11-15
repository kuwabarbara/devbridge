import type { RelateDb } from '@relate/relate-wasm';

export const RELATE_VERSION = '1.0.1';
export const SEED = [
  "CREATE (:Developer {id: 'alice'}), (:Developer {id: 'bob'}), (:Repository {name: 'devbridge'})",
  "MATCH (a:Developer {id: 'alice'}), (b:Developer {id: 'bob'}) CREATE (a)-[:FOLLOWS]->(b)",
  "MATCH (d:Developer), (r:Repository {name: 'devbridge'}) CREATE (d)-[:CONTRIBUTED_TO]->(r)",
];
export const QUERIES = {
  follows: 'MATCH (a:Developer)-[:FOLLOWS]->(b:Developer) RETURN a.id AS source, b.id AS target',
  collaboration: 'MATCH (a:Developer)-[:CONTRIBUTED_TO]->(r:Repository)<-[:CONTRIBUTED_TO]-(b:Developer) WHERE a.id = $from AND b.id = $to RETURN a.id AS source, r.name AS repository, b.id AS target',
};
export type Envelope = { rows: Record<string, unknown>[]; stats: Record<string, number>; error: string | null; elapsed_ms: number };
export function execute(db: RelateDb, cypher: string, params: Record<string, unknown> = {}): Envelope {
  const result: Envelope = JSON.parse(db.execute(cypher, JSON.stringify(params)));
  if (result.error !== null) throw new Error(result.error);
  return result;
}
export function seedDemo(db: RelateDb) {
  return SEED.map(query => execute(db, query));
}
export function queryDemo(db: RelateDb) {
  return {
    follows: execute(db, QUERIES.follows),
    collaboration: execute(db, QUERIES.collaboration, { from: 'alice', to: 'bob' }),
  };
}
