#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  if [[ -f "$HOME/.nvm/nvm.sh" ]]; then source "$HOME/.nvm/nvm.sh"; fi
fi
if ! command -v node >/dev/null 2>&1; then
  print '未找到 Node.js。请安装 Node.js 22.13 或更新版本后再启动。'
  read '?按回车关闭'; exit 1
fi
if curl --silent --max-time 2 http://127.0.0.1:4179/api/projects >/dev/null 2>&1; then
  open http://127.0.0.1:4179
  exit 0
fi
print '学习空间：http://127.0.0.1:4179'
print '请保持这个窗口开启。关闭服务可按 Control+C。'
node server/index.mjs
