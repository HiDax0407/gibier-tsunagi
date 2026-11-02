# ジビエつなぎ（Gibier Tsunagi）

> Built with Claude: Japan 2026 応募作品 ／ テーマ1「あなたにしかない深さ」
> **アプリの中の人名・地名・数字はすべて架空です。**（下の「どれだけの市場か」の数字だけは国の公表資料）

![霜の林道を見回りに向かう猟師の後ろ姿（AI で生成した架空の場面）](public/img/photo_01_mimawari.jpg)

ベテラン猟師の長年の経験を、**話すだけ**で「手順」と「注意」の形に集める。
新しく入る人が、資格を取って一人前になるまでの**道のりを迷わず短く**する。
ベテランが教えた日を記録に残し、**教えることへの謝礼の根拠**にする。

---

## どれだけの市場か（国の公表資料）

| | 数 | 出どころ |
|---|---|---|
| 野生鳥獣による農作物の被害 | **188億円**（令和6年度） | 農林水産省「[全国の野生鳥獣による農作物被害状況](https://www.maff.go.jp/j/seisan/tyozyu/higai/hogai_zyoukyou/index.html)」 |
| 被害防止計画を作っている市町村 | **1,518**（令和6年4月末） | 農林水産省「[被害防止計画の作成及び鳥獣被害対策実施隊の設置状況](https://www.maff.go.jp/j/seisan/tyozyu/higai/keikaku_zisshitai/attach/pdf/index-85.pdf)」 |
| ジビエの処理加工施設 | **826 → 885**（令和6年度 → 令和7年度） | 農林水産省「[ジビエ利用拡大に関する資料](https://www.maff.go.jp/j/nousin/gibier/attach/pdf/suishin-319.pdf)」 |

使う側は、被害防止計画を持つ約1,500の市町村と、800を超える処理加工施設のチームです。

### どれだけの課題を解けるか

このアプリが解くのは、ジビエを続けるための「**人と経験の受け渡しの詰まり**」です。全部は解きません。

| 課題 | 度合い | 理由 |
|---|---|---|
| ベテランの経験が頭の中にしかない | ◎ | 話すだけで、手順と注意が本人の言葉で残る |
| 誰が休むと止まるか見えない | ◎ | 担当を入れれば「1人だけ」「空き」がすぐ見える |
| 新しい人が何から始めればいいか分からない・資格待ちで何もできない | ○ | 資格なしで今日から入れる役割と、一人前までの道のりを示す |
| ベテランが教える理由がない（善意頼み） | ○ | 教えた記録が残り、謝礼を払う側（町・処理場）の根拠になる |
| 資格を取るまでの期間 | △ | 試験の日程は県が決める。変わるのは迷う時間・待つだけの時間 |
| 農作物の被害・ジビエが普段の食べものになること | 対象外 | 担い手が続くことが前提。捕獲量・施設・販路は別の取り組み |

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

| 画面（下のタブ） | できること |
|---|---|
| 話す（経験を集める） | 大きなボタンを押して話すだけ。言葉はそのまま残り、声で読み上げて確かめられる。工程ごとの手順と注意・1つだけの聞き返しは Claude 接続後 |
| チーム | 「名産として出せる状態まで あと○つ」と、工程×今の担当。1人だけ・空き・資格の区分の印 |
| 止まる役割 | 「岩田さんが休むと止まる役割」を理由つきで。そこから募集カードへ |
| 募集 | 役割ごとの募集カードと一人前までの道のり（4段）。地域の人が自分で手を挙げ、チームが決める |
| 教えた記録 | 一緒にやった日・工程・相手。ベテラン本人とチームが「はい」で確かめる。月ごとの一覧を印刷・CSV で書き出し |
| 町の地区一覧（チームの画面の下から） | 町の担当の方向け。地区ごとに「1人だけの役割」「経験が残った工程」「手を挙げた人」「教えた回数」を数だけ。個人名は出さない |

## 使い方（4つの目線）

### 1. ベテラン猟師（岩田さん・78歳・架空）── 押して話すだけ
1. チームが渡すリンクを開く（ログインなし）。「話す」の大きなボタンを押して、いつもの言葉で話す。若い人が横でスマホを持って聞き取ってもよい
2. 聞き取った言葉が大きな字で出る。「この言葉のまま残す」を押す。方言も言い直しも、標準語に書き換えずに残る
3. 「声で聞く」で、残した言葉を読み上げて確かめられる。字が小さければ上の「大きな字」
4. 一緒にやった日は「教えた記録」に残り、本人が「はい」を押す
5. （Claude 接続後）残した話が工程ごとの「手順」「注意（なぜそうするか）」に並び、抜けている点を AI が**1つだけ**聞き返して読み上げる。AI は言っていないことを足さない

※ 1〜4 は今動く（声の入力はブラウザの音声入力。使えない端末では文字で入れる）。5 は Claude をつないでから

### 2. 地区のチーム（立ち上げ役）── 表を見て、募集カードを出す
1. 「チーム」で、工程ごとの担当を見る。「1人だけ」「空き」が一目で分かり、各工程に「資格が要る（要確認）」「資格なしで今日から入れる」の印が付く
2. 上の「名産として出せる状態まで あと○つ」で、ゴールまでの残りが分かる
3. 「止まる役割」で、誰かが休むと止まる役割が理由つきで並ぶ
4. 「募集カードを作る」から、その役割の募集カードへ（今は手書きの下書き。あとで Claude が未経験の人にも伝わる言葉で下書きを作り、チームが確かめてから出す）
5. 手を挙げた人の一覧を見て、チームが決める（AI は人を選ばない・順位をつけない）
6. 「教えた記録」で、ベテランと新しい人が一緒にやった記録にチームとして「はい」を押す。月末に一覧を印刷するか CSV で書き出し、町や処理場に渡す

### 3. 新しく入りたい人（高木さん・29歳・地域おこし協力隊・架空）── カードを見て手を挙げる
1. 「募集」でカードを見る。いつ・どうやって・どんな人に向くかが書いてある
2. 「資格なしで今日から始められます」のカードなら、すぐに手を挙げられる
3. カードの下に一人前までの道のりがある：今日からできること → 資格の確認（県や市町村の窓口へ・要確認）→ 先輩と二人で → 一人で
4. 「手を挙げる」を押し、自分の条件（曜日・できること）を書く
5. チームに決まったら、ベテランと一緒に入る（例：岩田さんの見回りに同行）。その日が「教えた記録」に残る

### 4. 町の担当の方 ── 地区ごとの数を見る
1. 「チーム」の画面の下の「町の地区一覧」を開く
2. 地区ごとに「1人だけの役割」「経験が残った工程」「手を挙げた人」「教えた回数」が数だけ並ぶ。個人名は出ない
3. どの地区で担い手が足りないかを、計画の見直しや報告の材料にする（使えるかは町の窓口で要確認）

### このアプリがしないこと

- **人を選ばない・順位をつけない**：手を挙げた人は手を挙げた順に並ぶだけ。決めるのはチーム
- **捕獲・処理のやり方、法令、衛生、資格の決まりを答えない・断定しない**：画面には「要確認」と出し、チームと県・市町村の窓口で確かめてもらう
- **金額を決めない・お金を動かさない・教え方に点数をつけない**：教えた記録は「いつ・何を・誰と」の記録だけ。謝礼の扱いはチームと町・処理場が決める
- **町の画面に個人名を出さない**：数だけを出す
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
| 期間中に作成 | 画像（`public/img/`・`docs/design/`） | 2026-11-02 のキックオフ後に AI（gpt-image-2）で生成した**架空の場面**。実在の人・場所ではない。`docs/design/` は見た目を合わせるための完成イメージ |
| 期間中に作成 | 上記以外のすべて（コード・画面・`data/kitazawa_roles.json`・`data/teach_records.json`・`data/town.json`（どれも架空）・テスト・フック・`CLAUDE.md`） | 作業の記録は [DEVLOG.md](DEVLOG.md) とコミット履歴 |

使っているもの：Node.js 標準機能のみ。Claude API は、ハッカソンで配布されたクレジットで、専用のキーと使用上限を設定してからつなぎます（キーはリポジトリに入れず環境変数で扱う）。

## Claude の使い方

アプリの中（予定）と、開発での使い方を [DEVLOG.md](DEVLOG.md) に日ごとに残しています。

- アプリの中：聞き手（抜けを1つだけ聞き返す・速い返事は軽いモデル）／まとめ役（話し言葉→手順と注意・上位モデル）／書き直し役（募集カードのやさしい言葉）
- 開発：Claude Code を中心に開発。この作品用のフック（`.claude/hooks/guard-commit.sh`：コミット前の秘密情報検査）などをリポジトリ内に期間中に作っています
- 秘密情報の守りは三段：Claude Code のフック → git のフック（`.githooks/`）→ GitHub（Actions での再検査と push protection）

![山あいの食堂に並ぶ鹿肉の煮込み定食（AI で生成した架空の場面）](public/img/photo_03_shokudo.jpg)

ゴールは、地域の名産として食卓に並ぶこと。（写真は AI で生成した架空の場面）

## ライセンス

MIT

---

## English summary

**Gibier Tsunagi** helps rural hunting teams in Japan pass on the know-how of aging veteran hunters.

- **Collect experience by just talking**: a veteran speaks, and the app organizes it into steps and cautions per stage, in the veteran's own words (Claude adds nothing that was not said).
- **A clear path to becoming a full member**: roles are split into "license required (to be confirmed)" and "no license needed — you can join today". Recruitment cards show the path from day one to working alone. Licensing itself cannot be shortened, so the app shortens the time spent not knowing where to start or waiting idle.
- **Teaching record**: days when a veteran and a newcomer worked together are recorded and confirmed by both the veteran and the team, then printed or exported monthly as the basis for a teaching fee paid by the town or processing facility. The app never sets amounts, moves money, or scores teaching.
- **Built for elderly hunters**: press one big button and talk (no login), large text, read-aloud, one follow-up question at a time, dialect kept as spoken.
- **Town view**: per-district counts only (single-person roles, stages with recorded experience, raised hands, confirmed teaching days). No personal names.
- The AI never ranks or selects people. People raise their hands; the team decides. The app does not answer questions about hunting methods, laws, hygiene or licensing.

Context (Japan, official MAFF data): crop damage by wild animals ¥18.8 billion (FY2024); 1,518 municipalities with damage-prevention plans; 826–885 game-meat processing facilities. All names, places and numbers inside the app are fictional. Photos are AI-generated fictional scenes. All code was written during the hackathon (from 2026-11-02 12:30 JST).
