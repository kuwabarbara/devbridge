import type { RelateDb } from '@relate/relate-wasm';
import type { GitHubSnapshot, Follow } from './github-types';
import type { Node, Edge } from './graph';
import { execute } from './relate-demo';
export const DIRECT_QUERY = 'MATCH (a:Developer)-[:FOLLOWS]->(b:Developer) WHERE (a.id = $from AND b.id = $to) OR (a.id = $to AND b.id = $from) RETURN a.id AS source, b.id AS target';
// Undirected adjacency deliberately includes common followers, common following and directed bridges.
export const COMMON_QUERY = 'MATCH (a:Developer)-[:FOLLOWS]-(m:Developer)-[:FOLLOWS]-(b:Developer) WHERE a.id = $from AND b.id = $to AND m.id <> $from AND m.id <> $to RETURN DISTINCT m.id AS contact';
export function searchFollows(db: RelateDb, data: GitHubSnapshot) {
  execute(db, 'UNWIND $people AS person CREATE (:Developer {id: person.login})', { people: data.developers });
  execute(db, 'UNWIND $edges AS edge MATCH (a:Developer {id: edge.source}), (b:Developer {id: edge.target}) CREATE (a)-[:FOLLOWS]->(b)', { edges: data.follows });
  const params = { from: data.profiles[0].login, to: data.profiles[1].login };
  const direct = execute(db, DIRECT_QUERY, params).rows as Follow[];
  const common = execute(db, COMMON_QUERY, params).rows.map(row => String(row.contact)).sort();
  // Retrieve the directed edges for the matched contacts from Relate too.
  const contacts = common.slice(0, 8);
  const links = execute(db, 'MATCH (a:Developer)-[:FOLLOWS]->(b:Developer) WHERE (a.id IN $ends AND b.id IN $contacts) OR (a.id IN $contacts AND b.id IN $ends) RETURN a.id AS source, b.id AS target', { ends: [params.from, params.to], contacts }).rows as Follow[];
  const nodes: Node[] = [
    { id: params.from, label: params.from, kind: 'user', x: 100, y: 210, role: '出発点の公開プロフィール' },
    { id: params.to, label: params.to, kind: 'user', x: 800, y: 210, role: '到着点の公開プロフィール' },
    ...contacts.map((id, i) => ({ id, label: id, kind: 'user' as const, x: 350 + (i % 2) * 200, y: 50 + Math.floor(i / 2) * 95, role: '両者にフォロー関係で隣接する公開アカウント' })),
  ];
  const edges: Edge[] = [...direct, ...links].map(link => ({ ...link, kind: 'follow' }));
  return { nodes, edges, directCount: direct.length, commonCount: common.length, shownContacts: contacts.length };
}
export type FollowGraph = ReturnType<typeof searchFollows>;
export async function loadFollowGraph(data: GitHubSnapshot): Promise<FollowGraph> {
  const { default: init, RelateDb } = await import('@relate/relate-wasm');
  await init({ module_or_path: '/relate/relate_bg.wasm' });
  const db = new RelateDb();
  try { return searchFollows(db, data); } finally { db.free(); }
}
