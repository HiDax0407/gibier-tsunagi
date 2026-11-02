# ジビエつなぎ（Gibier Tsunagi）

> Built with Claude: Japan 2026 応募作品 ／ テーマ1「あなたにしかない深さ」
> **人名・地名・数字はすべて架空です。**

ベテラン猟師の長年の経験を、**話すだけ**で「手順」と「注意」の形に集める。
新しく入る人が、資格を取って一人前になるまでの**道のりを迷わず短く**する。

---

## 誰の・どんな課題か

山あいの地区では、シカやイノシシの被害が増える一方で、捕獲から処理・出荷までを担うベテランが高齢になっています。

- **ベテラン猟師**（70代）：見回りの順番、二人で行く理由、冷やす早さ、洗う手間を惜しまない理由。長年の経験が頭の中にしかなく、書いたものがない。出荷先の店とのやりとりも一人で抱えている。「わしが倒れたら、店の番号も誰も知らん」
- **新しく入りたい人**（地域おこし協力隊・地域の勤め人など）：何から始めればよいか分からない。資格が要る役割と要らない役割の区別がつかず、資格が取れるまで「待つだけ」になりがち
- **地区のチーム**：誰が倒れたらどこが止まるかが見えない。地域の名産として出し続けられる体制か分からない

作者は、流通・補助金・現場支援で生産者やジビエの現場に並走してきました。そこで繰り返し見たのは「段取りが次の人に渡らないまま、担い手がいなくなる」ことです。

## どう解決するか

ゴールは「**地域の名産として出せる状態**」。そこから逆算して、2本の柱だけに絞っています。

1. **経験を集める**：ベテランが話すだけで、工程ごとの「手順」と「注意（なぜそうするか）」にまとまる。本人の言葉のまま残し、AI は足さない
2. **道のりを迷わず短く**：役割を「資格が要る（要確認）」と「資格なしで今日から入れる」に分け、募集カードに一人前までの道のりを載せる。資格そのものは法律と県の決まりで短くできないので、短くするのは「何から始めるか迷う時間」と「資格を待つ間に何もできない時間」

| 画面 | できること |
|---|---|
| 1 経験を集める | ベテランが話す → 工程ごとの手順と注意（Claude 接続後） |
| 2 チームの表 | 工程×今の担当。○2人以上／△1人だけ／×空き。資格の区分の印。ゴールまでの進み具合 |
| 3 止まる役割 | 「この人が倒れたら止まる役割」を理由つきで |
| 4 募集カード | 役割ごとの募集と一人前までの道のり。地域の人が自分で手を挙げ、チームが決める |

### このアプリがしないこと

- **人を選ばない・順位をつけない**：手を挙げた人は手を挙げた順に並ぶだけ。決めるのはチーム
- **捕獲・処理のやり方、法令、衛生、資格の決まりを答えない・断定しない**：画面には「要確認」と出し、チームと県・市町村の窓口で確かめてもらう
- 処理の場面を絵や写真で見せない

## 試し方

Node.js 20 以上が必要です。外部のライブラリは使っていません。

```bash
git clone https://github.com/HiDax0407/gibier-tsunagi.git
cd gibier-tsunagi
npm run setup-hooks   # 秘密情報のコミットを止める仕組みを有効にする
npm start             # http://localhost:8791
```

スマホの幅で見ることを前提にしています。テストは `npm test`。

## 期間中に作ったもの／事前に用意したもの

ハッカソンのルール（キックオフ前のコード・既存プロジェクトの再利用は不可）に従い、**コードはすべて 2026-11-02 12:30（開発開始）以降に新しく書いたもの**です。既存のアプリのコードは持ち込んでいません。

| 区分 | もの | 備考 |
|---|---|---|
| 事前に用意 | `data/prepared/gibier_team.json` | 2026-11-02 朝（キックオフ前）に作者が作った**架空の**テキストデータ。手を加えずに置いている |
| 事前に用意 | 設計メモ | リポジトリの外に置いている（構想・計画） |
| 期間中に作成 | 上記以外のすべて（コード・画面・`data/kitazawa_roles.json`・テスト・フック・`CLAUDE.md`） | 作業の記録は [DEVLOG.md](DEVLOG.md) とコミット履歴 |

使っているもの：Node.js 標準機能のみ。Claude API は、ハッカソンで配布されたクレジットで、専用のキーと使用上限を設定してからつなぎます（キーはリポジトリに入れず環境変数で扱う）。

## Claude の使い方

アプリの中（予定）と、開発での使い方を [DEVLOG.md](DEVLOG.md) に日ごとに残しています。

- アプリの中：聞き手（抜けを1つだけ聞き返す・速い返事は軽いモデル）／まとめ役（話し言葉→手順と注意・上位モデル）／書き直し役（募集カードのやさしい言葉）
- 開発：Claude Code を中心に開発。この作品用のフック（`.claude/hooks/guard-commit.sh`：コミット前の秘密情報検査）などをリポジトリ内に期間中に作っています

## ライセンス

MIT

---

## English summary

**Gibier Tsunagi** helps rural hunting teams in Japan pass on the know-how of aging veteran hunters.

- **Collect experience by just talking**: a veteran speaks, and the app organizes it into steps and cautions per stage, in the veteran's own words (Claude adds nothing that was not said).
- **A clear path to becoming a full member**: roles are split into "license required (to be confirmed)" and "no license needed — you can join today". Recruitment cards show the path from day one to working alone. Licensing itself cannot be shortened, so the app shortens the time spent not knowing where to start or waiting idle.
- The AI never ranks or selects people. People raise their hands; the team decides. The app does not answer questions about hunting methods, laws, hygiene or licensing.

All names, places and numbers are fictional. All code was written during the hackathon (from 2026-11-02 12:30 JST).
