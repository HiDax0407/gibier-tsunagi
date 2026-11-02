#!/bin/sh
# Claude Code のフック（PreToolUse / Bash）。
# Claude Code が git commit / git push をしようとしたとき、先に秘密情報の検査を通す。
# git add と commit を1行で続けて打つ場合に備え、コミットされうる全ファイルも調べる。
# 検査に引っかかったら終了コード 2 で止め、理由を Claude Code に返す。
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input.command||"")}catch{}})')
case "$cmd" in
  *"git commit"*|*"git push"*)
    cd "$CLAUDE_PROJECT_DIR" || exit 0
    if ! out=$(node scripts/check-secrets.mjs --staged 2>&1 && node scripts/check-secrets.mjs --worktree 2>&1); then
      printf '%s\n' "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
