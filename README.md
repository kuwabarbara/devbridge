# DevBridge

GitHub の開発者をつなぐフォロー・OSS 共同貢献の経路を可視化する Next.js / TypeScript のプロトタイプです。

## 開発

Node.js 20.9 以降を使用します。

```sh
npm ci
npm run dev
```

```sh
npm test
npm run typecheck
npm run build
npm start
```

2つの異なる GitHub ID を入力して探索できます。フィルター、ノードの詳細表示、ズーム、表示リセットに対応しています。表示する5ノード・2経路は架空で、ユーザーの実在確認や外部 API 呼び出しは行いません。統計はフィルター前の全経路を示します。

## Relate 動作検証

`/relate-check`（画面下部の「RELATE 動作検証」リンク）で、公式 `@relate/relate-wasm@1.0.1` の実エンジンに3ノード・3関係を登録し、Cypher でフォロー関係と共同貢献を検索します。外部 Neo4j サーバー、API キー、GitHub API は使いません。既存のマップは引き続き架空データで、Relate による探索に置き換えていません。

DB は実行ごとに作成するメモリー内 DB で、検索終了時に破棄します。永続化・端末間共有はありません。公式 Relate は Rust 製の組み込みグラフエンジンです。以前の「ローカルの DBMS 管理ツール」という説明は別製品との混同であり、訂正しています。

`npm run dev` / `npm run build` の前処理で、ロックファイルに固定した公式パッケージの WASM を `public/relate/` にコピーします。生成物はコミットしません。初回約6.8 MBを同一オリジンから取得し、以降はブラウザーで Cypher を実行します。

## Vercel

GitHub の `main` を Import し、Framework Preset は Next.js、Root Directory はリポジトリ直下、Build Command は **`npm run build`** を指定します（`next build` の直接指定では WASM 配置処理を実行しません）。`vercel.json` にも同じ Build Command を指定済みです。環境変数は不要です。デプロイ後に `/` と `/relate-check` を開き、検証ボタンの実行で2つの検索結果が出ることを確認してください。

調査根拠・構成比較・検証結果は [docs/relate-validation.md](docs/relate-validation.md) を参照してください。
