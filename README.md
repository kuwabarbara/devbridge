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

## データ接続

`lib/graph.ts` に型とデモデータを分離しています。Neo4j Relate はローカルの DBMS 管理ツールです。この初期実装では Neo4j サーバーや認証情報は不要です。実データ対応時は Next.js のサーバー側に Neo4j ドライバーと GitHub API 取得処理を追加し、秘密情報をブラウザーに渡さない構成にします。
