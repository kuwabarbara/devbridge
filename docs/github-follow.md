# 公開フォロー探索

## 使い方と範囲

メイン画面で「GitHub 公開フォローを探索」を選び、異なる2人の GitHub ID を入力して探索する。初期表示と「架空データのデモ」は既存デモを維持し、`/relate-check` も独立して利用できる。

Next.js の `GET /api/github?from=…&to=…` が、固定した公式 `https://api.github.com` だけへアクセスする。認証ヘッダーや環境変数のトークンは使用しない。ユーザー入力で外部 URL や Cypher を組み立てない。ID を検証し、Cypher の値はすべてパラメーターとして渡す。

[公式 REST API 定義](https://github.com/github/rest-api-description/blob/main/descriptions/api.github.com/api.github.com.json) の以下のエンドポイントを使用する。API version は `2022-11-28`。

| 対象 | エンドポイント | 上限 |
| --- | --- | --- |
| 公開プロフィール | `/users/{username}` | 2リクエスト |
| 公開フォロー中 | `/users/{username}/following?per_page=100&page=1` | 2リクエスト |
| 公開フォロワー | `/users/{username}/followers?per_page=100&page=1` | 2リクエスト |
| 直接フォローの確認 | `/users/{username}/following/{target_user}` | 両方向で2リクエスト（204=あり、404=なし） |

合計最大8リクエスト。途中で失敗したら打ち切り、部分データを成功扱いしない。直接関係は一覧の先頭100件から外れていても独立に両方向を確認する。取得時間の違いによる API スナップショットの不一致では、後に行う直接確認を採用する。一覧は追加ページをたどらず、`Link: rel="next"` があれば一部取得と明示する。API の仕様上の非公開情報や一覧から省かれるユーザーまでは保証できない。

## 制限・キャッシュ

- サーバーの各ウォームインスタンスで最大48 HTTPリクエスト/時（失敗も計上）、同時の新規探索は1件。
- 同じ順序の2 ID は5分間メモリーキャッシュする（最大20組）。取得日時を表示する。キャッシュはプロセス再起動で消える。
- `X-RateLimit-Remaining` / `X-RateLimit-Reset` を読み取り、残数0で取得を止める。403/429では `Retry-After` または最低60秒の待機を扱い、API応答で再試行の待機秒数を返す。自動リトライしない。
- 各 GitHub 呼び出しは5秒でタイムアウト。Route Handler は Node.js runtime / maxDuration=60。Vercelに環境変数の追加は不要。
- キャッシュ・予算・待機は分散した全インスタンス間で共有されない。無認証の GitHub API は送信元 IP を共有する他アプリの消費にも影響されるので、成功回数を保証できない。GitHub の応答ヘッダーを優先する。大量利用に向けた分散制限・認証・永続化は今回の対象外。

## Relate の実検索

取得したユーザーを `(:Developer {id})`、取得した方向を `[:FOLLOWS]` として、ブラウザーの実 `@relate/relate-wasm@1.0.1` に登録する。登録は `UNWIND` とパラメーター、検索は以下の Cypher で行う（完全な文字列は `lib/relate-follow.ts`）。検索後は DB を `free()` する。グラフ・検索結果の永続化はない。

```cypher
MATCH (a:Developer)-[:FOLLOWS]->(b:Developer)
WHERE (a.id = $from AND b.id = $to) OR (a.id = $to AND b.id = $from)
RETURN a.id AS source, b.id AS target
```

```cypher
MATCH (a:Developer)-[:FOLLOWS]-(m:Developer)-[:FOLLOWS]-(b:Developer)
WHERE a.id = $from AND b.id = $to AND m.id <> $from AND m.id <> $to
RETURN DISTINCT m.id AS contact
```

「共通接点」は共通フォロー先・共通フォロワー・方向付きの2段階の橋渡しを含む、フォロー関係による隣接を意味する。両者が知人であることは意味しない。3段階以上や OSS 貢献は探索しない。共通接点は全取得範囲内の件数を表示し、図には ID 順で先頭8人までを表示する。表示用の有向エッジも Relate から再検索する。矢印はフォローする側→される側。ノード詳細の GitHub リンクで公開プロフィールを開ける。

関係なしは「取得範囲内で見つからない」と表示し、GitHub 全体に関係がないとは結論しない。取得・Relate 検索エラー時は図を空にし、以前の検索結果や架空データで補わない。

## 検証

`npm test` で API 正常応答・8リクエスト上限・方向・一部取得・キャッシュ・不正 ID・404・不正応答・レート制限・通信失敗・時間内予算を検証する。ネットワーク応答のテストは固定したテストデータで再現し、実際の API の可用性とは区別する。

Relate テストは配布された実 WASM を使い、直接関係、共通フォロー先、共通フォロワー、2段階の橋渡し、3段階の除外、関係なし、図の上限、API 応答の正規化から実エンジン検索までを検証する。Relate をモックしていない。

このクラウドからの無認証 `https://api.github.com/users/torvalds` へのライブ接続はネットワークで拒否されたため、ライブ API データの取得成功はまだ確認できていない。公式 API 定義は GitHub の公式リポジトリから確認した。許可設定の適用後または Vercel 上で、実ユーザー2人による検索と、図の矢印・プロフィールリンクを照合する必要がある。

本番モードの Chromium で、固定した API 応答から実 WASM 検索・グラフ表示まで、プロフィールリンク、関係なし、429 時に図が空になること、モバイルの横はみ出しなしを確認した。さらに既存デモの入力・詳細・フィルターと `/relate-check` の実検索も通過した。公開 API のライブ接続では同環境の `/api/github` が接続失敗を HTTP 502 で返し、架空データで補完しないことを確認した。
