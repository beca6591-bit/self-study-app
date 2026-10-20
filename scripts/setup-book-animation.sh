#!/bin/sh
# Isolated Apple Silicon runtime for the pinned DeepTutor AnimationGenerator.
set -eu
app_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_dir="$app_root/.runtime"
[ "$(uname -s)-$(uname -m)" = Darwin-arm64 ] || { echo 'This setup script targets Apple Silicon macOS.'; exit 1; }
mkdir -p "$runtime_dir/bin" "$runtime_dir/downloads"
if [ ! -x "$runtime_dir/bin/micromamba" ]; then
  curl -fL --retry 2 https://micro.mamba.pm/api/micromamba/osx-arm64/latest -o "$runtime_dir/downloads/micromamba.tar.bz2"
  tar -xjf "$runtime_dir/downloads/micromamba.tar.bz2" -C "$runtime_dir" bin/micromamba
fi
if [ ! -x "$runtime_dir/animation/bin/python" ]; then
  "$runtime_dir/bin/micromamba" create --no-rc --yes --root-prefix "$runtime_dir/mamba" --prefix "$runtime_dir/animation" -c conda-forge python=3.14 manim=0.22.0 ffmpeg
fi
tex_repository=${SELF_STUDY_TEX_REPOSITORY:-https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/tlnet}
if [ ! -x "$runtime_dir/texlive/bin/universal-darwin/tlmgr" ]; then
  curl -fL --retry 2 "$tex_repository/install-tl-unx.tar.gz" -o "$runtime_dir/downloads/texlive.tar.gz"
  mkdir -p "$runtime_dir/downloads/install-tl"
  tar -xzf "$runtime_dir/downloads/texlive.tar.gz" -C "$runtime_dir/downloads/install-tl" --strip-components=1
  cat > "$runtime_dir/downloads/texlive.profile" <<EOF
selected_scheme scheme-basic
TEXDIR $runtime_dir/texlive
TEXMFCONFIG $runtime_dir/texlive-user/config
TEXMFVAR $runtime_dir/texlive-user/var
TEXMFHOME $runtime_dir/texlive-user/home
TEXMFLOCAL $runtime_dir/texlive/texmf-local
TEXMFSYSCONFIG $runtime_dir/texlive/texmf-config
TEXMFSYSVAR $runtime_dir/texlive/texmf-var
option_doc 0
option_src 0
option_path 0
option_desktop_integration 0
EOF
  perl "$runtime_dir/downloads/install-tl/install-tl" --profile "$runtime_dir/downloads/texlive.profile" --repository "$tex_repository"
fi
tex_manager="$runtime_dir/texlive/bin/universal-darwin/tlmgr"
"$tex_manager" --repository "$tex_repository" update --self
"$tex_manager" --repository "$tex_repository" install dvisvgm standalone preview doublestroke relsize ragged2e physics xcolor microtype tipa jknapltx calligra wasysym setspace
printf '%s\n' 'Animation runtime installed. Restart the app, then check /api/books/health and render a real video.'
