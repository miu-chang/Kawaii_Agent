# RVCモデルディレクトリ

このディレクトリには、つくよみちゃん/あみたろのRVCモデル（ONNX形式）を配置します。

## 必要なファイル

```
public/rvc-models/
├── tsukuyomi.onnx  (つくよみちゃんRVCモデル)
└── amitaro.onnx    (あみたろRVCモデル)
```

## モデルの入手方法

### 1. つくよみちゃん公式RVCモデル

**公式配布ページ**: https://tyc.rei-yumesaki.net/work/software/rvc/

- ✅ **アプリケーションへの組み込みOK**（再配布には該当しない）
- ✅ **商用利用OK**
- ⚠️ **クレジット表記必須**: 「元音源」と「つくよみちゃん公式RVCモデル」の両方

ダウンロードしたモデル（.pth）をONNX形式に変換してください（下記参照）。

### 2. あみたろRVCモデル

**公式配布ページ**: https://amitaro.net/synth/rvc/

- ✅ **商用利用OK**
- ✅ **アプリケーションへの組み込みOK**
- ⚠️ **クレジット表記必須**: "RVCモデル：あみたろの声素材工房（https://amitaro.net/）"
- ⚠️ **全年齢向けコンテンツのみ**（アダルト・グロ禁止）

ダウンロードしたモデル（.pth）をONNX形式に変換してください（下記参照）。

### 3. PyTorchモデルをONNX形式に変換

RVCモデルがPyTorch形式（.pth）の場合、ONNX形式に変換が必要です：

```python
# 変換スクリプト例（要調整）
import torch
import onnx

# RVCモデルをロード
model = load_rvc_model('tsukuyomi.pth')
model.eval()

# ダミー入力を作成（モデルに合わせて調整）
dummy_input = torch.randn(1, 16000)  # 1秒、16kHz

# ONNX形式にエクスポート
torch.onnx.export(
    model,
    dummy_input,
    'tsukuyomi.onnx',
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={
        'input': {1: 'length'},
        'output': {1: 'length'}
    }
)
```

**参考リンク**:
- Hugging Face Hub: https://huggingface.co/models?search=rvc+onnx
- GitHub検索: "RVC ONNX"

## ライセンスと配布について

### アプリケーションへの同梱

**✅ 両モデルともアプリケーションへの同梱が可能です**

- つくよみちゃん: アプリ組み込みは「再配布」に該当しない（公式規約より）
- あみたろ: 商用利用・アプリ組み込みOK（公式規約より）

### 必須クレジット表記

アプリケーション内（設定画面やAbout画面など）に以下を記載してください：

```
音声合成モデル:
- つくよみちゃん公式RVCモデル (https://tyc.rei-yumesaki.net/work/software/rvc/)
- RVCモデル：あみたろの声素材工房 (https://amitaro.net/)
- 元音源：OpenAI TTS (nova)
```

### モデルファイルサイズ
- 通常 50-200MB程度
- アプリの配布サイズに影響します

## モデルなしでの動作

モデルファイルが配置されていない場合：
- OpenAI TTS（nova）の音声がそのまま使用されます
- エラーは発生せず、警告ログのみ表示されます
- 機能自体は動作します（RVC変換のみスキップ）

## 実装状況

現在の実装では：
1. ✅ OpenAI TTSで抑揚豊富な音声生成
2. 🔄 RVC変換（モデルファイル配置後に自動有効化）
3. ✅ 音声再生

モデルファイルを配置すると、自動的にRVC変換が有効になります。
