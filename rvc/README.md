# RVC Voice Conversion - Python Setup

このディレクトリには、RVC音声変換用のPythonスクリプトが含まれています。

## 必要な環境

- Python 3.8 以上
- pip（Pythonパッケージマネージャー）

## 依存パッケージのインストール

```bash
pip install torch librosa soundfile numpy
```

### 各パッケージの役割

- **torch (PyTorch)**: RVCモデルのロードと推論に使用
- **librosa**: 音声ファイルの読み込みとリサンプリング
- **soundfile**: 音声ファイルの保存
- **numpy**: 数値計算

## 使用方法

### コマンドライン実行（テスト用）

```bash
python convert.py <入力音声ファイル> <モデル名> <出力音声ファイル>
```

**例:**
```bash
python convert.py input.mp3 つくよみちゃん output.wav
python convert.py input.mp3 あみたろ output.wav
```

### Electronアプリから自動実行

Electronアプリを起動すると、main.jsが自動的にこのスクリプトを呼び出します。
手動で実行する必要はありません。

## RVCモデルファイル

RVCモデルファイル（.pth）は `public/rvc-models/` ディレクトリに配置してください。

現在対応しているモデル：
- つくよみちゃん公式RVCモデル（通常1-3、強、弱）
- あみたろRVCモデル

詳細は `public/rvc-models/README.md` を参照してください。

## トラブルシューティング

### Pythonが見つからない

```
python3: command not found
```

**解決策**: Python 3をインストールしてください
- macOS: `brew install python3`
- Windows: https://www.python.org/downloads/

### パッケージが見つからない

```
ModuleNotFoundError: No module named 'torch'
```

**解決策**: 依存パッケージをインストールしてください
```bash
pip3 install torch librosa soundfile numpy
```

### モデルファイルが見つからない

```
Model file not found: /path/to/model.pth
```

**解決策**: モデルファイルを `public/rvc-models/` に配置してください

## 実装ステータス

### 現在の実装

- ✅ 基本的なスクリプト構造
- ✅ モデルファイルのロード
- ✅ 音声ファイルのI/O
- ✅ Electron IPC統合

### TODO（今後の実装）

- 🔄 F0（ピッチ）抽出
- 🔄 HuBERT特徴抽出
- 🔄 RVCモデル推論
- 🔄 音声合成

現在は**プレースホルダー実装**となっており、入力音声をそのまま出力します。
実際のRVC推論を実装するには、RVCの推論ライブラリ（rvc-pythonなど）を統合する必要があります。

## 参考リンク

- RVC公式: https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
- PyTorch: https://pytorch.org/
- Librosa: https://librosa.org/
