import { isValidGitHubId, validateIds } from './graph';
import type { Developer, Follow, GitHubSnapshot } from './github-types';

export class GitHubError extends Error {
  constructor(message: string, public status = 502, public retryAfter = 0) { super(message); }
}
const API = 'https://api.github.com';
const TTL = 5 * 60_000;
// Per warm server instance; GitHub's response headers are the authoritative shared-IP limit.
export function createGitHubClient(request: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; value: GitHubSnapshot }>();
  let busy = false, used = 0, windowEnd = 0, blockedUntil = 0;
  let remaining: number | null = null;
  let resetAt = 0;
  async function get(path: string, direct = false): Promise<{ data: unknown; linked: boolean; truncated: boolean }> {
    const time = now();
    if (time < blockedUntil) throw new GitHubError('GitHub のレート制限中です。時間をおいて再試行してください。', 429, Math.ceil((blockedUntil - time) / 1000));
    if (time >= windowEnd) { used = 0; windowEnd = time + 3_600_000; }
    if (remaining !== null && time >= resetAt) remaining = null;
    if (used >= 48 || remaining === 0) throw new GitHubError('公開 API の呼び出し上限に達しました。時間をおいて再試行してください。', 429, Math.max(1, Math.ceil(((remaining === 0 ? resetAt : windowEnd) - time) / 1000)));
    used++;
    let response: Response;
    try {
      response = await request(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'DevBridge-public-follow-explorer' }, cache: 'no-store', signal: AbortSignal.timeout(5_000), redirect: 'error' });
    } catch { throw new GitHubError('GitHub に接続できませんでした。時間をおいて再試行してください。'); }
    const left = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    if (left !== null && /^\d+$/.test(left)) remaining = Number(left);
    if (reset !== null && /^\d+$/.test(reset)) resetAt = Number(reset) * 1000;
    else if (remaining === 0) resetAt = time + 3_600_000;
    if (response.status === 403 || response.status === 429) {
      const retry = response.headers.get('retry-after');
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 60;
      blockedUntil = Math.max(time + seconds * 1000, remaining === 0 ? resetAt : 0);
      throw new GitHubError('GitHub のレート制限またはアクセス制限により取得できません。時間をおいて再試行してください。', 429, Math.max(1, Math.ceil((blockedUntil - time) / 1000)));
    }
    if (direct && [204, 404].includes(response.status)) return { data: null, linked: response.status === 204, truncated: false };
    if (response.status === 404) throw new GitHubError('GitHub ユーザーが見つかりません。ID を確認してください。', 404);
    if (!response.ok) throw new GitHubError('GitHub からデータを取得できませんでした。');
    let data: unknown;
    try { data = await response.json(); } catch { throw new GitHubError('GitHub の応答形式を確認できませんでした。'); }
    return { data, linked: false, truncated: /rel="next"/.test(response.headers.get('link') || '') };
  }
  function developer(value: unknown): Developer {
    const v = value as { login?: unknown; name?: unknown } | null;
    if (!v || typeof v.login !== 'string' || !isValidGitHubId(v.login)) throw new GitHubError('GitHub のユーザーデータを確認できませんでした。');
    return { login: v.login.toLowerCase(), name: typeof v.name === 'string' ? v.name : null, url: `https://github.com/${v.login}` };
  }
  return async function snapshot(first: string, second: string): Promise<GitHubSnapshot> {
    const issue = validateIds(first, second);
    if (issue) throw new GitHubError(issue, 400);
    const key = `${first.toLowerCase()}:${second.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.value;
    if (busy) throw new GitHubError('別の公開 API 取得を実行中です。少し待って再試行してください。', 429, 5);
    busy = true;
    try {
      const a = developer((await get(`/users/${encodeURIComponent(first)}`)).data);
      const b = developer((await get(`/users/${encodeURIComponent(second)}`)).data);
      if (a.login === b.login) throw new GitHubError('異なる2人の GitHub ID を入力してください。', 400);
      const people = new Map<string, Developer>([[a.login, a], [b.login, b]]);
      const follows = new Map<string, Follow>();
      let truncated = false;
      function add(source: string, target: string) { if (source !== target) follows.set(`${source}:${target}`, { source, target }); }
      for (const person of [a, b]) {
        for (const kind of ['following', 'followers'] as const) {
          const result = await get(`/users/${person.login}/${kind}?per_page=100&page=1`);
          if (!Array.isArray(result.data) || result.data.length > 100) throw new GitHubError('GitHub のフォロー一覧を確認できませんでした。');
          truncated ||= result.truncated;
          for (const item of result.data) {
            const neighbor = developer(item);
            if (!people.has(neighbor.login)) people.set(neighbor.login, neighbor);
            if (kind === 'following') add(person.login, neighbor.login); else add(neighbor.login, person.login);
          }
        }
      }
      // Independent checks guarantee both direct directions even when lists are capped.
      for (const [source, target] of [[a.login, b.login], [b.login, a.login]]) {
        const check = await get(`/users/${source}/following/${target}`, true);
        follows.delete(`${source}:${target}`);
        if (check.linked) add(source, target);
      }
      const value: GitHubSnapshot = { profiles: [a, b], developers: [...people.values()], follows: [...follows.values()], fetchedAt: new Date(now()).toISOString(), truncated, remaining };
      if (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: now() + TTL, value });
      return value;
    } finally { busy = false; }
  };
}
export const fetchGitHubSnapshot = createGitHubClient();
