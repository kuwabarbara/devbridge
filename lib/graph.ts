export type Node = { id: string; label: string; kind: 'user' | 'repository'; x: number; y: number; role: string };
export type Edge = { source: string; target: string; kind: 'follow' | 'contribution' };
export function isValidGitHubId(id: string): boolean {
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(id) && !id.includes('--');
}
export function validateIds(first: string, second: string): string | null {
  if (![first, second].every(isValidGitHubId)) return '有効な GitHub ID を入力してください（英数字・ハイフン、最大39文字）。';
  if (first.toLowerCase() === second.toLowerCase()) return '異なる2人の GitHub ID を入力してください。';
  return null;
}
export function createDemoGraph(first: string, second: string): { nodes: Node[]; edges: Edge[] } {
  return { nodes: [
    {id:'start',label:first,kind:'user',x:100,y:210,role:'探索の出発点'},
    {id:'middle',label:'sindresorhus',kind:'user',x:340,y:120,role:'オープンソース開発者'},
    {id:'repo',label:'vercel / next.js',kind:'repository',x:560,y:210,role:'共同貢献リポジトリ'},
    {id:'end',label:second,kind:'user',x:800,y:210,role:'探索の到着点'},
    {id:'extra',label:'open-source / tools',kind:'repository',x:340,y:350,role:'共同貢献リポジトリ'}
  ], edges:[{source:'start',target:'middle',kind:'follow'},{source:'middle',target:'repo',kind:'contribution'},{source:'repo',target:'end',kind:'contribution'},{source:'start',target:'extra',kind:'contribution'},{source:'extra',target:'end',kind:'contribution'}] };
}
