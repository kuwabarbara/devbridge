'use client';
import { useState } from 'react';
import Link from 'next/link';
import { QUERIES, RELATE_VERSION, seedDemo, queryDemo } from '@/lib/relate-demo';
export default function RelateCheck() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof queryDemo> | null>(null);
  const [error, setError] = useState('');
  async function run() {
    setRunning(true); setError(''); setResult(null);
    let db: import('@relate/relate-wasm').RelateDb | undefined;
    try {
      const { default: init, RelateDb } = await import('@relate/relate-wasm');
      await init({ module_or_path: '/relate/relate_bg.wasm' });
      db = new RelateDb();
      seedDemo(db);
      setResult(queryDemo(db));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Relate の実行に失敗しました');
    } finally {
      db?.free(); setRunning(false);
    }
  }
  return <article className="relate-check"><Link href="/">← DevBridge に戻る</Link><div className="eyebrow">RELATE ENGINE PROOF OF CONCEPT</div><h1>Relate 動作検証</h1><p>公式 @relate/relate-wasm {RELATE_VERSION} をブラウザーで実行します。Neo4j サーバーや模擬の検索処理は使いません。</p><p>架空の alice・bob・devbridge の3ノードと、フォロー1本・貢献2本を登録し、2種類の Cypher 検索を実行します。</p><p className="relate-warning">メモリー内の一時 DB です。実行ごとに作成し、検索後に破棄します。永続化・端末間の共有はありません。</p><button className="primary" disabled={running} onClick={run}>{running ? 'Relate を実行中…' : 'サンプル登録と Cypher 検索を実行'}</button><div role="status" aria-live="polite">{running ? 'WASM エンジンを読み込み・実行しています' : result ? '実際の Relate エンジンで検索が完了しました' : ''}</div>{error && <p role="alert" className="error">実行エラー: {error}</p>}{Object.entries(QUERIES).map(([key, query])=><section key={key}><h2>{key === 'follows' ? 'フォロー関係' : 'OSS 共同貢献'}</h2><pre>{query}</pre>{key === 'collaboration' && <p>パラメーター: from = alice, to = bob</p>}{result && <pre data-testid={key}>{JSON.stringify(result[key as keyof typeof result], null, 2)}</pre>}</section>)}<p>初回は約 6.8 MB の WASM を取得します。大規模なグラフ向けの性能検証は今回の対象外です。</p></article>;
}
