#!/bin/sh
# Claude Code のフック（PreToolUse / Bash）。
# Claude Code が git を使う命令を打つとき、先に秘密情報の検査を通す（書き方の言い換えですり抜けないよう、
# commit / push に限らず git という語を含む命令はすべて検査する）。
# 検査を飛ばす指定（--no-verify・core.hooksPath の上書き）は止める。
# 引っかかったら終了コード 2 で止め、理由を Claude Code に返す。
# ※ いちばん確実な守りは git 自体のフック（.githooks/pre-commit・pre-push）。これは手前の二重の守り。
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input.command||"")}catch{process.stdout.write("__PARSE_ERROR__")}})')

if [ "$cmd" = "__PARSE_ERROR__" ]; then
  echo "フックが入力を読めませんでした。安全のため止めます。" >&2
  exit 2
fi

case "$cmd" in
  *git*) ;;
  *) exit 0 ;;
esac

if printf '%s' "$cmd" | grep -Eq -- '--no-verify|commit([[:space:]].*)?[[:space:]]-n([[:space:]]|$)|hooksPath|core\.hooks'; then
  echo "秘密情報の検査を飛ばす指定（--no-verify / core.hooksPath の変更）は使えません。" >&2
  exit 2
fi

if [ -z "$CLAUDE_PROJECT_DIR" ] || ! cd "$CLAUDE_PROJECT_DIR"; then
  echo "作品のフォルダが分からないため、安全のため止めます。" >&2
  exit 2
fi
if ! out=$(node scripts/check-secrets.mjs --staged 2>&1 && node scripts/check-secrets.mjs --worktree 2>&1); then
  printf '%s\n' "$out" >&2
  exit 2
fi
exit 0
