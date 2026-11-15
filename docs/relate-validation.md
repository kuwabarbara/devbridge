# Relate 検証記録

## 対象と根拠

調査・実行日: 2026-11-16（Asia/Tokyo）。公式 GitHub main を取得した時点のコミットは `2f2956f6b46bcab5df753078c740e534fe8f1e33`。npm の公開最新バージョンとして確認した `@relate/relate-wasm` / `@relate/relate` はともに `1.0.1`。本実装は WASM 版 `1.0.1` を厳密固定し、実際に配布された型定義と API に照合した。

- [公式 README](https://github.com/relatedb/relate/blob/2f2956f6b46bcab5df753078c740e534fe8f1e33/README.md)
- [公式 WASM API](https://github.com/relatedb/relate/blob/2f2956f6b46bcab5df753078c740e534fe8f1e33/docs/api/wasm/spec.md)
- [公式 JavaScript API](https://github.com/relatedb/relate/blob/2f2956f6b46bcab5df753078c740e534fe8f1e33/docs/api/javascript/spec.md)
- [公式制約](https://github.com/relatedb/relate/blob/2f2956f6b46bcab5df753078c740e534fe8f1e33/docs/limitations.md)
- [指定インストール資料](https://relatedb.ai/docs/get-started/install/) と [Devpost](https://relate.devpost.com/) はクラウドのネットワークから取得できなかった。前者は HTTP 403、後者は接続できず HTTP レスポンスなし。したがってハッカソンの提出条件・期限・指定バージョンへの適合は未確認。公式 GitHub の資料でエンジンと導入 API を確認したことと、ハッカソン参加条件の確認完了とは区別する。

Relate は Rust 製の組み込み・インメモリーのプロパティグラフエンジン。同一エンジンに CLI、Python、Node.js、WASM、Rust、サーバーの入口がある。単なる Neo4j ドライバーや DBMS 管理ツールではない。Cypher は広範に対応するが、完全な Neo4j 互換とは仮定しない。

## Next.js / TypeScript の選択肢

| 構成 | 正式導入方法・API | Vercel との関係 | 永続性・制約 |
| --- | --- | --- | --- |
| ブラウザー WASM（今回採用） | `npm install @relate/relate-wasm`。`await init(...)`、`new RelateDb()`、`execute(cypher, paramsJson)`。型定義が同梱される | クライアントから遅延 import。静的 WASM を同一オリジンから配信し、Functions のバイナリやディスクに依存しない | 今回はメモリーのみ。実行終了時に破棄。同期・単一スレッドなので大規模処理は UI を止め得る。約6.8 MBの初回ダウンロード。OPFS 永続化は公式に存在するが専用 Worker が必要で、今回は未実装。端末間共有にはならない |
| Node.js 組み込み | `npm install @relate/relate`。Node 18+。`Database.open(':memory:')` → `connect().query(cypher, params)`。公式配布型付き。koffi 経由の C ABI と OS/arch ごとの optional dependency | Next.js の Node runtime に限定し、ネイティブ依存のバンドル・配置・ABI・実行環境互換性の確認が必要。Edge では使わない。今回未導入・未検証 | Relate 自体はファイル/WAL/チェックポイントを提供するが、Vercel の一時ファイルやインスタンス内メモリーを共有永続 DB にしてはいけない。リクエスト間・デプロイ間の保持を保証しない |
| 外部 Relate サービス | Relate 自身の `relate serve --database ... --bolt ... --http ... --mcp ...`。HTTP Query API v2 / Bolt 対応 | 永続ディスクのある別ホストで Relate を動かし、Vercel のサーバーから接続する構成が共有データ向き。普通の Neo4j サーバーへの接続とは区別する | 外部ホストの運用・バックアップ・認証・TLS が必要。公式 serve はループバック既定・平文で、公開時は TLS 終端などを整備する。今回未構築・未検証 |

今回の目的である小さな実エンジン検証には WASM が最小構成。共有・永続な GitHub グラフを実装する段階では、外部 Relate サービスまたは別途検証した永続化戦略を再評価する。

## 実装と検索

`lib/relate-demo.ts` に固定サンプルと Cypher を配置。`/relate-check` はクリック時だけ WASM をロードし、実 DB を作成。`execute` の JSON envelope 内 `error` を確認して失敗を表示する。失敗時に架空の成功結果へフォールバックしない。結果はエンジンからの rows / stats / elapsed_ms をそのまま表示する。終了時は `free()` でハンドルを解放する。

登録するデータ:

```text
(alice:Developer)-[:FOLLOWS]->(bob:Developer)
(alice)-[:CONTRIBUTED_TO]->(devbridge:Repository)
(bob)-[:CONTRIBUTED_TO]->(devbridge)
```

フォロー検索:

```cypher
MATCH (a:Developer)-[:FOLLOWS]->(b:Developer)
RETURN a.id AS source, b.id AS target
```

共同貢献検索（パラメーター `from=alice`, `to=bob`）:

```cypher
MATCH (a:Developer)-[:CONTRIBUTED_TO]->(r:Repository)<-[:CONTRIBUTED_TO]-(b:Developer)
WHERE a.id = $from AND b.id = $to
RETURN a.id AS source, r.name AS repository, b.id AS target
```

期待結果はそれぞれ `{source: 'alice', target: 'bob'}` と `{source: 'alice', repository: 'devbridge', target: 'bob'}`。

## 自動検証と Vercel

`npm test` は既存2件と Relate 実エンジンの2件、計4件。Relate は Node 上でも実際の配布 WASM バイトをロードし、登録カウンター・検索値・データ削除後の結果変化・存在しないユーザー・パラメーター注入文字列・構文エラー・新規 DB の非永続性を検証する。mock は使用しない。

`npm run build` の prebuild で公式 npm artifact の WASM を `public/relate/relate_bg.wasm` に配置する。コミットするのは配置スクリプトとロックファイルで、バイナリ・node_modules・.next・認証情報は含めない。既存 `/` はサンプル表示のまま維持し、フッターに検証ページへのリンクのみ追加する。Next.js 本番ビルドで両ページの静的生成を確認する。GitHub 連携の Vercel デプロイは Build Command を `npm run build` とする必要があり、`vercel.json` に明示している。

本番モードのローカル Chromium でも WASM の HTTP 200、2検索の結果、再実行で重複しないこと、リロードで結果が消えること、モバイル幅の横はみ出しなし、ブラウザー実行エラーなしを確認。これは Vercel 公開環境での確認と別の検証であり、公開先へのアクセスができない間は Vercel 反映済みとは扱わない。
