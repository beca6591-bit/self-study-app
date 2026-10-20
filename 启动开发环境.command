#!/bin/zsh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  if [[ -f "$HOME/.nvm/nvm.sh" ]]; then source "$HOME/.nvm/nvm.sh"; fi
fi
if ! command -v node >/dev/null 2>&1; then
  print '未找到 Node.js，请安装 Node.js 22.13 或更新版本。'
  read '?按回车关闭'; exit 1
fi
npm run dev
if [[ $? -ne 0 ]]; then read '?启动未完成，请查看错误，按回车关闭'; fi
