# TTS Mod 開発ガイド / TTS Mod Development Guide / TTS Mod 开发指南

## 日本語

### 概要

Kawaii Agentは、カスタムTTS（音声合成）エンジンをModとして追加できる拡張システムを提供しています。これにより、開発者は独自の音声エンジンをパッケージ化し、ユーザーに配布・販売することができます。

### Modの構造

TTSモッドは以下のファイルで構成されたZIPファイルです：

```
my-tts-mod.zip
├── manifest.json      # Mod情報（必須）
├── tts-service.js     # TTS実装（必須）
├── voices.json        # 声一覧（オプション）
└── icon.png          # アイコン（オプション）
```

### 1. manifest.json

Modの基本情報を定義します。

```json
{
  "id": "my-custom-tts",
  "name": "マイカスタムTTS",
  "version": "1.0.0",
  "author": "開発者名",
  "description": "カスタム音声合成エンジン",
  "type": "tts",
  "languages": ["ja", "en", "zh"]
}
```

**必須フィールド:**
- `id`: Modの一意なID（英数字とハイフンのみ）
- `name`: Mod名
- `version`: バージョン（セマンティックバージョニング推奨）
- `type`: `"tts"` 固定

**オプションフィールド:**
- `author`: 開発者名
- `description`: 説明文
- `languages`: 対応言語の配列

### 2. tts-service.js

TTSエンジンの実装です。以下のクラスをエクスポートしてください：

```javascript
// Modのエクスポート形式
module.exports.default = class CustomTTSService {
  constructor(voices) {
    this.voices = voices; // voices.jsonの内容が渡される
  }

  /**
   * 音声合成を実行
   * @param {string} text - 合成するテキスト
   * @param {Object} options - オプション
   * @param {string} options.speaker - 話者ID
   * @param {number} options.speed - 速度 (0.5-2.0)
   * @param {number} options.pitch - 音高 (-1.0-1.0)
   * @param {string} options.language - 言語コード ('ja', 'en', 'zh')
   * @returns {Promise<Blob>} 音声データ（WAV, MP3等）
   */
  async speak(text, options = {}) {
    const { speaker, speed = 1.0, pitch = 0, language = 'ja' } = options;

    // あなたのTTS APIを呼び出す
    const response = await fetch('https://your-tts-api.com/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: speaker,
        speed: speed,
        pitch: pitch,
        language: language
      })
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    // 音声データをBlobとして返す
    return await response.blob();
  }

  /**
   * 利用可能な話者の一覧を取得
   * @returns {Promise<Array>} 話者リスト
   */
  async getVoices() {
    // voices.jsonから返す、またはAPIから取得
    return this.voices || [];
  }

  /**
   * サービスが利用可能かチェック（オプション）
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch('https://your-tts-api.com/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3. voices.json（オプション）

利用可能な声の一覧を定義します：

```json
[
  {
    "id": "voice_001",
    "name": "さくら（明るい）",
    "language": "ja",
    "gender": "female"
  },
  {
    "id": "voice_002",
    "name": "たろう（落ち着いた）",
    "language": "ja",
    "gender": "male"
  }
]
```

**フィールド:**
- `id`: 声の一意なID
- `name`: 表示名
- `language`: 言語コード（`ja`, `en`, `zh`等）
- `gender`: 性別（`male`, `female`, `neutral`）（オプション）

### 4. icon.png（オプション）

Modのアイコン画像（推奨サイズ: 128x128px）

### テスト方法

1. 上記ファイルをZIP形式で圧縮
2. Kawaii Agentを起動
3. 設定 → 音声合成 → 「TTSモッドをインポート」
4. ZIPファイルを選択

### 配布方法

- BOOTH、Gumroadなどで販売
- GitHubでオープンソース公開
- 独自サイトで配布

### セキュリティについて

⚠️ **重要**: Modは任意のJavaScriptコードを実行できます。信頼できる開発者のModのみをインストールしてください。

開発者は以下を守ってください：
- ユーザーデータを無断で外部送信しない
- 悪意あるコードを含めない
- APIキーが必要な場合は、ユーザーに設定方法を明示

---

## English

### Overview

Kawaii Agent provides an extension system that allows custom TTS (Text-to-Speech) engines to be added as Mods. This enables developers to package their own voice engines and distribute or sell them to users.

### Mod Structure

A TTS mod is a ZIP file containing the following files:

```
my-tts-mod.zip
├── manifest.json      # Mod information (Required)
├── tts-service.js     # TTS implementation (Required)
├── voices.json        # Voice list (Optional)
└── icon.png          # Icon (Optional)
```

### 1. manifest.json

Define basic information about the Mod.

```json
{
  "id": "my-custom-tts",
  "name": "My Custom TTS",
  "version": "1.0.0",
  "author": "Developer Name",
  "description": "Custom text-to-speech engine",
  "type": "tts",
  "languages": ["ja", "en", "zh"]
}
```

**Required fields:**
- `id`: Unique Mod ID (alphanumeric and hyphens only)
- `name`: Mod name
- `version`: Version (semantic versioning recommended)
- `type`: Fixed to `"tts"`

**Optional fields:**
- `author`: Developer name
- `description`: Description
- `languages`: Array of supported languages

### 2. tts-service.js

TTS engine implementation. Export the following class:

```javascript
// Export format for the Mod
module.exports.default = class CustomTTSService {
  constructor(voices) {
    this.voices = voices; // Contents of voices.json are passed
  }

  /**
   * Synthesize speech
   * @param {string} text - Text to synthesize
   * @param {Object} options - Options
   * @param {string} options.speaker - Speaker ID
   * @param {number} options.speed - Speed (0.5-2.0)
   * @param {number} options.pitch - Pitch (-1.0-1.0)
   * @param {string} options.language - Language code ('ja', 'en', 'zh')
   * @returns {Promise<Blob>} Audio data (WAV, MP3, etc.)
   */
  async speak(text, options = {}) {
    const { speaker, speed = 1.0, pitch = 0, language = 'ja' } = options;

    // Call your TTS API
    const response = await fetch('https://your-tts-api.com/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: speaker,
        speed: speed,
        pitch: pitch,
        language: language
      })
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    // Return audio data as Blob
    return await response.blob();
  }

  /**
   * Get list of available voices
   * @returns {Promise<Array>} Voice list
   */
  async getVoices() {
    // Return from voices.json or fetch from API
    return this.voices || [];
  }

  /**
   * Check if service is available (Optional)
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch('https://your-tts-api.com/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3. voices.json (Optional)

Define a list of available voices:

```json
[
  {
    "id": "voice_001",
    "name": "Sakura (Cheerful)",
    "language": "ja",
    "gender": "female"
  },
  {
    "id": "voice_002",
    "name": "Taro (Calm)",
    "language": "ja",
    "gender": "male"
  }
]
```

**Fields:**
- `id`: Unique voice ID
- `name`: Display name
- `language`: Language code (`ja`, `en`, `zh`, etc.)
- `gender`: Gender (`male`, `female`, `neutral`) (Optional)

### 4. icon.png (Optional)

Mod icon image (Recommended size: 128x128px)

### Testing

1. Compress the above files into ZIP format
2. Launch Kawaii Agent
3. Settings → Voice Synthesis → "Import TTS Mod"
4. Select the ZIP file

### Distribution

- Sell on BOOTH, Gumroad, etc.
- Publish as open source on GitHub
- Distribute from your own website

### Security

⚠️ **Important**: Mods can execute arbitrary JavaScript code. Only install Mods from trusted developers.

Developers should:
- Not transmit user data externally without consent
- Not include malicious code
- Clearly document API key setup if required

---

## 中文

### 概述

Kawaii Agent 提供了扩展系统，允许将自定义TTS（文本转语音）引擎作为Mod添加。这使开发者能够打包自己的语音引擎并分发或销售给用户。

### Mod结构

TTS Mod是包含以下文件的ZIP文件：

```
my-tts-mod.zip
├── manifest.json      # Mod信息（必需）
├── tts-service.js     # TTS实现（必需）
├── voices.json        # 语音列表（可选）
└── icon.png          # 图标（可选）
```

### 1. manifest.json

定义Mod的基本信息。

```json
{
  "id": "my-custom-tts",
  "name": "我的自定义TTS",
  "version": "1.0.0",
  "author": "开发者名称",
  "description": "自定义文本转语音引擎",
  "type": "tts",
  "languages": ["ja", "en", "zh"]
}
```

**必需字段：**
- `id`：唯一的Mod ID（仅限字母数字和连字符）
- `name`：Mod名称
- `version`：版本（建议使用语义化版本）
- `type`：固定为`"tts"`

**可选字段：**
- `author`：开发者名称
- `description`：描述
- `languages`：支持的语言数组

### 2. tts-service.js

TTS引擎实现。导出以下类：

```javascript
// Mod的导出格式
module.exports.default = class CustomTTSService {
  constructor(voices) {
    this.voices = voices; // 传入voices.json的内容
  }

  /**
   * 合成语音
   * @param {string} text - 要合成的文本
   * @param {Object} options - 选项
   * @param {string} options.speaker - 说话者ID
   * @param {number} options.speed - 速度 (0.5-2.0)
   * @param {number} options.pitch - 音高 (-1.0-1.0)
   * @param {string} options.language - 语言代码 ('ja', 'en', 'zh')
   * @returns {Promise<Blob>} 音频数据（WAV、MP3等）
   */
  async speak(text, options = {}) {
    const { speaker, speed = 1.0, pitch = 0, language = 'ja' } = options;

    // 调用你的TTS API
    const response = await fetch('https://your-tts-api.com/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: speaker,
        speed: speed,
        pitch: pitch,
        language: language
      })
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    // 以Blob形式返回音频数据
    return await response.blob();
  }

  /**
   * 获取可用语音列表
   * @returns {Promise<Array>} 语音列表
   */
  async getVoices() {
    // 从voices.json返回或从API获取
    return this.voices || [];
  }

  /**
   * 检查服务是否可用（可选）
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch('https://your-tts-api.com/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3. voices.json（可选）

定义可用语音列表：

```json
[
  {
    "id": "voice_001",
    "name": "樱花（开朗）",
    "language": "ja",
    "gender": "female"
  },
  {
    "id": "voice_002",
    "name": "太郎（沉稳）",
    "language": "ja",
    "gender": "male"
  }
]
```

**字段：**
- `id`：唯一的语音ID
- `name`：显示名称
- `language`：语言代码（`ja`、`en`、`zh`等）
- `gender`：性别（`male`、`female`、`neutral`）（可选）

### 4. icon.png（可选）

Mod图标图像（推荐大小：128x128px）

### 测试方法

1. 将上述文件压缩为ZIP格式
2. 启动Kawaii Agent
3. 设置 → 语音合成 → "导入TTS Mod"
4. 选择ZIP文件

### 分发方法

- 在BOOTH、Gumroad等平台销售
- 在GitHub上开源发布
- 从自己的网站分发

### 安全性

⚠️ **重要**：Mod可以执行任意JavaScript代码。仅安装来自可信开发者的Mod。

开发者应当：
- 不在未经同意的情况下向外部传输用户数据
- 不包含恶意代码
- 如需API密钥，请明确说明设置方法

---

## サンプルMod / Sample Mod / 示例Mod

完全なサンプルは以下のリポジトリを参照してください：
For a complete sample, refer to the following repository:
完整示例请参考以下仓库：

https://github.com/miu-chang/kawaii-agent-tts-mod-sample

---

## ライセンス / License / 许可证

MIT License

Copyright (c) 2025 miu-chang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
