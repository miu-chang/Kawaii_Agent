#!/bin/bash
# RVC Converter Binary Build Script

set -e

echo "🔨 Building RVC converter binary..."

# Python環境チェック
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# PyInstallerのインストールチェック
if ! python3 -c "import PyInstaller" &> /dev/null; then
    echo "📦 Installing PyInstaller..."
    pip3 install pyinstaller
fi

# 依存パッケージのインストールチェック
echo "📦 Checking dependencies..."
pip3 install torch librosa soundfile numpy

# PyInstallerでビルド
echo "🔧 Building with PyInstaller..."
cd "$(dirname "$0")"
pyinstaller rvc_convert.spec --clean

# 成果物を確認
if [ -f "dist/rvc_convert" ]; then
    echo "✅ Build successful: dist/rvc_convert"
    echo "📦 Binary size: $(du -h dist/rvc_convert | cut -f1)"
else
    echo "❌ Build failed"
    exit 1
fi

echo "✨ Done!"
