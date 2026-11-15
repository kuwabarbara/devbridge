import { fetchGitHubSnapshot, GitHubError } from '@/lib/github';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const snapshot = await fetchGitHubSnapshot((params.get('from') || '').trim(), (params.get('to') || '').trim());
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof GitHubError;
    return Response.json({ error: known ? error.message : '公開データの取得に失敗しました。' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store', ...(known && error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) } });
  }
}
