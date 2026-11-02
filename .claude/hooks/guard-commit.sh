#!/bin/sh
# Claude Code のフック（PreToolUse / Bash）。
# Claude Code が git commit / git push をしようとしたとき、先に秘密情報の検査を通す。
# git add と commit を1行で続けて打つ場合に備え、コミットされうる全ファイルも調べる。
# 検査に引っかかったら終了コード 2 で止め、理由を Claude Code に返す。
# ※ いちばん確実な守りは git 自体のフック（.githooks/pre-commit・pre-push）。これは手前の二重の守り。
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input.command||"")}catch{process.stdout.write("__PARSE_ERROR__")}})')

if [ "$cmd" = "__PARSE_ERROR__" ]; then
  echo "フックが入力を読めませんでした。安全のため止めます。" >&2
  exit 2
fi

# 「git」のあとにオプション（-C dir・-c key=val など）が挟まっても、commit / push を見つける
if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])git([[:space:]]+-{1,2}[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+(commit|push)([[:space:]]|$)'; then
  if [ -z "$CLAUDE_PROJECT_DIR" ] || ! cd "$CLAUDE_PROJECT_DIR"; then
    echo "作品のフォルダが分からないため、安全のため止めます。" >&2
    exit 2
  fi
  if ! out=$(node scripts/check-secrets.mjs --staged 2>&1 && node scripts/check-secrets.mjs --worktree 2>&1); then
    printf '%s\n' "$out" >&2
    exit 2
  fi
fi
exit 0
