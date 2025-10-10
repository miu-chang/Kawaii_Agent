# Kawaii Agent

AI搭載のデスクトップコンパニオン / AI-powered Desktop Companion / AI桌面伴侣

---

## 重要：2つのバージョンについて / About Two Versions / 关于两个版本

### 日本語

このリポジトリには2つの使い方があります：

**1. オープンソース版（Git版）**
- このリポジトリからソースコードをビルド
- ライセンス不要
- 自分のOpenAI APIキーが必要（有料）
- 開発者・上級者向け
- カスタマイズ自由

**2. パッケージ版（BOOTH販売）**
- ビルド済みアプリケーション
- ライセンスキーが必要（BOOTHで購入）
- OpenAI APIキー不要（バックエンド経由で提供）
- 一般ユーザー向け
- すぐに使える

### English

This repository offers two ways to use:

**1. Open Source Version (Git)**
- Build from source code in this repository
- No license required
- Your own OpenAI API key required (paid)
- For developers and advanced users
- Fully customizable

**2. Packaged Version (BOOTH)**
- Pre-built application
- License key required (purchase from BOOTH)
- No OpenAI API key needed (provided via backend)
- For general users
- Ready to use

### 中文

本仓库提供两种使用方式：

**1. 开源版（Git版）**
- 从本仓库构建源代码
- 无需许可证
- 需要自己的OpenAI API密钥（付费）
- 面向开发者和高级用户
- 可自由定制

**2. 打包版（BOOTH销售）**
- 预构建应用程序
- 需要许可证密钥（从BOOTH购买）
- 无需OpenAI API密钥（通过后端提供）
- 面向普通用户
- 即开即用

---

## 目次 / Table of Contents / 目录

### 日本語
- [概要](#概要--overview--概述)
- [主な機能](#主な機能--features--主要功能)
- [TTS Mod 開発ガイド](#tts-mod-開発ガイド--tts-mod-development-guide--tts-mod-开发指南)
- [インストール](#インストール--installation--安装)
- [システム要件](#システム要件--system-requirements--系统要求)
- [アーキテクチャ](#architecture)
- [ライセンス](#ライセンス--license--许可证)
- [お問い合わせ](#お問い合わせ--contact--support--联系--支持)

### English
- [Overview](#概要--overview--概述)
- [Features](#主な機能--features--主要功能)
- [TTS Mod Development Guide](#tts-mod-開発ガイド--tts-mod-development-guide--tts-mod-开发指南)
- [Installation](#インストール--installation--安装)
- [System Requirements](#システム要件--system-requirements--系统要求)
- [Architecture](#architecture)
- [License](#ライセンス--license--许可证)
- [Contact & Support](#お問い合わせ--contact--support--联系--支持)

### 中文
- [概述](#概要--overview--概述)
- [主要功能](#主な機能--features--主要功能)
- [TTS Mod 开发指南](#tts-mod-開発ガイド--tts-mod-development-guide--tts-mod-开发指南)
- [安装](#インストール--installation--安装)
- [系统要求](#システム要件--system-requirements--系统要求)
- [架构](#architecture)
- [许可证](#ライセンス--license--许可证)
- [联系与支持](#お問い合わせ--contact--support--联系--支持)

---

## 概要 / Overview / 概述

### 日本語

Kawaii Agentは、最先端の会話AIと豊かな表現力を持つ3Dキャラクターモデルを組み合わせた、高度なAI搭載デスクトップコンパニオンです。ElectronとReactで構築され、自然言語処理、音声認識、物理ベースのアニメーションを通じて、バーチャルキャラクターとシームレスに対話できます。

**主な特徴：**
- GPT-4.1 miniによる自然な会話
- VRMおよびMMD（MikuMikuDance）モデル対応
- 64種のVRMAアニメーション + 17種のMMDモーション収録
- VOICEVOX TTS（100種以上のキャラクターボイス）
- リアルタイム感情検出と表情制御
- ウェイクワード検出によるハンズフリー操作
- Ammo.jsによる物理ベースアニメーション
- Function calling（Web検索、天気、ニュース）
- キャラクターと動作の完全カスタマイズ
- **TTS Modシステム（カスタム音声エンジン対応）**

### English

Kawaii Agent is an advanced AI-powered desktop companion that combines cutting-edge conversational AI with highly expressive 3D character models. Built on Electron and React, it provides a seamless experience for interacting with virtual characters through natural language processing, voice recognition, and physics-based animations.

**Key Highlights:**
- GPT-4.1 mini integration for natural conversations
- VRM and MMD (MikuMikuDance) model support
- 64 VRMA animations + 17 MMD motions included
- VOICEVOX TTS with 100+ character voices
- Real-time emotion detection and expression control
- Wake word detection for hands-free interaction
- Physics-based animation using Ammo.js
- Function calling (web search, weather, news)
- Fully customizable character and behavior
- **TTS Mod System (Custom voice engine support)**

### 中文

Kawaii Agent是一款先进的AI桌面伴侣，结合了前沿的对话AI与富有表现力的3D角色模型。基于Electron和React构建，通过自然语言处理、语音识别和基于物理的动画，提供与虚拟角色无缝交互的体验。

**主要亮点：**
- 使用GPT-4.1 mini进行自然对话
- 支持VRM和MMD（MikuMikuDance）模型
- 包含64个VRMA动画 + 17个MMD动作
- VOICEVOX TTS（100+角色语音）
- 实时情感检测和表情控制
- 唤醒词检测实现免提交互
- 使用Ammo.js的基于物理的动画
- 函数调用（网络搜索、天气、新闻）
- 完全可定制的角色和行为
- **TTS Mod系统（支持自定义语音引擎）**

---

## 主な機能 / Features / 主要功能

### 日本語

**AI会話システム**
- GPT-4.1 miniによる自然な対話
- 7種類の感情検出（喜び、悲しみ、怒り、驚き、恐怖、嫌悪、中立）
- Whisper APIによる音声認識
- ウェイクワード検出（カスタマイズ可能）
- Function calling（Web検索、天気、ニュース）

**3Dキャラクター**
- VRMモデル対応（表情・視線制御）
- MMDモデル対応（物理演算・VMDモーション）
- 64種のVRMAアニメーション収録
- ドラッグ&ドロップでモデル・モーション追加可能

**音声合成（TTS）**
- VOICEVOX統合（100種以上の日本語ボイス）
- 声質調整（速度・ピッチ・抑揚）
- **TTS Modシステム（カスタムエンジン追加可能）**
- 商用利用可能な声（適切なクレジット表記で）

**インタラクション**
- タップ機能（部位別反応）
- 撫でモード（長押しドラッグ）
- GPT-5 nanoによる自動部位認識
- 物理演算によるリアルな反応

### English

**AI Conversation System**
- Natural dialogue with GPT-4.1 mini
- 7-emotion detection (joy, sadness, anger, surprise, fear, disgust, neutral)
- Speech recognition via Whisper API
- Wake word detection (customizable)
- Function calling (web search, weather, news)

**3D Characters**
- VRM model support (expression & eye tracking)
- MMD model support (physics & VMD motion)
- 64 VRMA animations included
- Drag-and-drop model/motion import

**Text-to-Speech (TTS)**
- VOICEVOX integration (100+ Japanese voices)
- Voice customization (speed, pitch, intonation)
- **TTS Mod System (add custom engines)**
- Commercial-use voices (with proper credit)

**Interactions**
- Tap feature (body-part reactions)
- Pet mode (long-press drag)
- GPT-5 nano automatic part recognition
- Physics-based realistic responses

### 中文

**AI对话系统**
- 使用GPT-4.1 mini进行自然对话
- 7种情感检测（喜悦、悲伤、愤怒、惊讶、恐惧、厌恶、中立）
- 通过Whisper API进行语音识别
- 唤醒词检测（可自定义）
- 函数调用（网络搜索、天气、新闻）

**3D角色**
- 支持VRM模型（表情和视线控制）
- 支持MMD模型（物理和VMD动作）
- 包含64个VRMA动画
- 拖放导入模型/动作

**文本转语音（TTS）**
- VOICEVOX集成（100+日语语音）
- 语音自定义（速度、音高、语调）
- **TTS Mod系统（添加自定义引擎）**
- 商业使用语音（需适当署名）

**交互功能**
- 点击功能（身体部位反应）
- 抚摸模式（长按拖动）
- GPT-5 nano自动部位识别
- 基于物理的真实反应

---

## TTS Mod 開発ガイド / TTS Mod Development Guide / TTS Mod 开发指南

### 日本語

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

### English

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

### 中文

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

### サンプルMod / Sample Mod / 示例Mod

完全なサンプルは以下のリポジトリを参照してください：
For a complete sample, refer to the following repository:
完整示例请参考以下仓库：

https://github.com/miu-chang/kawaii-agent-tts-mod-sample

---

### ライセンス / License / 许可证

MIT License

Copyright (c) 2025 miu-chang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

---

## Architecture

### Technology Stack

**Frontend**
- Framework: Electron 38.2.0
- UI Library: React 19.2.0
- 3D Rendering: Three.js 0.170.0
- React Three: @react-three/fiber 9.3.0
- VRM Support: @pixiv/three-vrm 3.4.2
- MMD Parser: mmd-parser 1.0.4
- Physics: ammojs-typed 1.0.6

**Backend (Vercel)**
- Node.js serverless functions
- Vercel Postgres database
- License verification API
- OpenAI API proxy

**AI Services**
- OpenAI GPT-4.1 mini (conversation)
- OpenAI GPT-5 nano (emotion detection, bone classification)
- OpenAI Whisper (speech recognition)
- VOICEVOX (text-to-speech)

### Project Structure

```
kawaii-agent/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── renderer.js          # React entry point
│   ├── App.jsx              # Main application component
│   ├── components/
│   │   ├── VRMViewer.jsx    # 3D character renderer
│   │   ├── LicenseModal.jsx # License input modal
│   │   └── AboutModal.jsx   # About dialog
│   ├── services/
│   │   ├── aiService.js           # AI conversation management
│   │   ├── licenseApi.js          # License API client
│   │   ├── voicevoxService.js     # TTS integration
│   │   ├── voiceRecorder.js       # Audio recording & VAD
│   │   ├── speechRecognition.js   # Wake word detection
│   │   ├── replicateService.js    # Replicate API client
│   │   ├── tools.js               # Function calling tools
│   │   ├── localMotionAI.js       # Motion control
│   │   ├── voicePrintService.js   # Voice analysis
│   │   └── moeTTSService.js       # MoeTTS (hidden feature)
│   └── utils/
│       ├── vrmMotions.js          # VRM animation helpers
│       ├── vrmGestures.js         # Gesture system
│       ├── vrmIdleAnimations.js   # Idle animation manager
│       ├── vrmaLoader.js          # VRMA animation loader
│       ├── indexedDB.js           # Local storage
│       └── math.js                # Math utilities
├── public/
│   ├── animations/           # 64 VRMA files
│   ├── models/              # Default VRM/MMD models
│   ├── モーション/            # 17 MMD VMD files
│   └── *.wasm               # ONNX Runtime WebAssembly
├── dist/                    # Webpack build output (562MB)
├── .env                     # Environment variables
├── webpack.config.js        # Webpack configuration
└── package.json            # Dependencies and scripts
```

### Service Modules (11 files)

1. **aiService.js** - Core AI conversation logic, emotion detection, function calling
2. **licenseApi.js** - License verification, backend API communication
3. **voicevoxService.js** - VOICEVOX TTS integration, voice synthesis
4. **voiceRecorder.js** - Audio recording, VAD, audio processing
5. **speechRecognition.js** - Wake word detection, Whisper API calls
6. **replicateService.js** - Replicate API integration for future models
7. **tools.js** - Function calling tool definitions (search, weather, news)
8. **localMotionAI.js** - Local motion AI for animation selection
9. **voicePrintService.js** - Voice fingerprint analysis
10. **moeTTSService.js** - MoeTTS integration (hidden, localStorage-activated)
11. **umaVoiceService.js** - Uma Musume voices (legacy)

---

## Installation

### Option 1: Pre-built Package (BOOTH Version)

**For general users - Recommended**

1. Purchase license key from BOOTH
2. Download the application package
3. Extract and run the executable
4. Enter your license key when prompted
5. No additional setup required

**Advantages:**
- No OpenAI API key needed
- Backend handles all API calls
- Simple setup for non-technical users
- Regular updates and support
- Ready to use immediately

### Option 2: Build from Source (Open Source Version)

**For developers and advanced users**

#### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Git

#### Clone Repository

```bash
git clone https://github.com/miu-chang/Kawaii_Agent.git
cd Kawaii_Agent
```

#### Install Dependencies

```bash
npm install
```

#### Build

```bash
# Development build
npm run build

# Production build
npm run build

# Start Electron
npm start
```

#### Environment Variables

Create `.env` file:

```env
# Required for Open Source Version
OPENAI_API_KEY=your_openai_api_key_here

# Optional: News function
NEWS_API_KEY=your_news_api_key_here

# Backend URL (already configured)
BACKEND_API_URL=https://kawaii-agent-backend.vercel.app
```

**Note:** Open Source version requires your own OpenAI API key. Get one at https://platform.openai.com/api-keys

---

## Configuration

### BOOTH Version (Licensed)

**Initial Setup**
1. Launch application
2. Enter license key in modal dialog
3. Click "AI初期化" button
4. Wait for model loading (30 seconds)
5. Start conversation

**Settings**
- License key: Stored securely in localStorage
- OpenAI API: Provided automatically via backend
- Updates: Automatic with package
- No additional configuration needed

### Open Source Version (Self-hosted)

**Initial Setup**
1. Launch application
2. Enter your OpenAI API key in settings
3. Click "AI初期化" button
4. Wait for model loading
5. Start conversation

**Required API Keys**
- OpenAI API key: **Required** for AI features
- News API key: Optional, for news function
- Weather API: Uses free OpenWeatherMap (no key needed for basic)

**Settings File**
All settings stored in browser's localStorage:
- `openaiApiKey`: Your OpenAI API key
- `systemPrompt`: Character personality
- `ttsEngine`: Selected TTS engine
- `voiceCharacter`: Selected voice
- `chatHistory`: Conversation history

---

## Usage

### First Launch

1. Start application
2. License/API key modal appears
3. Enter credentials
4. Click "AI初期化" to initialize AI
5. Wait for model loading progress
6. Initial greeting appears

### Basic Conversation

**Text Input**
- Type message in chat input box
- Press Enter or click send button
- AI responds with voice and animation

**Voice Input**
- Click microphone button
- Speak your message
- Click stop when done
- Whisper transcribes and sends to AI

### Wake Word Detection

**Setup**
1. Enable "音声検出を常時ON" in settings
2. Configure wake word (default: "アリシア")
3. AI initialization starts listening

**Usage**
- Say wake word: "アリシア"
- Conversation mode activates (20 minutes)
- Speak naturally without clicking buttons
- Mode ends automatically after timeout

### Character Interaction

**Tap Interaction**
- Click character body parts
- AI responds based on location
- Physics responds to tap
- Customizable reactions per part

**Pet Mode**
- Long-press and drag on character
- Petting animation plays
- Affectionate response
- Multiple petting prompts

### Model Import

**VRM Models**
- Drag VRM file onto window
- Model loads automatically
- Saved to IndexedDB
- Switch models in settings

**MMD Models**
- Drag PMX file onto window
- Textures auto-detected
- Physics simulation applied
- Saved for reuse

**Animations**
- Drag VRMA/VMD/BVH file onto window
- Animation imports to library
- Play from animation list
- Favorite for quick access

### Voice Customization

**VOICEVOX Settings**
1. Open settings panel
2. Select "TTSエンジン" → VOICEVOX
3. Choose character from 100+ voices
4. Adjust speed, pitch, intonation
5. Test with preview button

**Voice Search**
- Type character name in search box
- Filter from 100+ voices
- Preview before selecting

### Camera Controls

**Mouse Follow**
- Enable in settings
- Character eyes track cursor
- Natural looking behavior

**Manual Camera**
- Drag to rotate view
- Scroll to zoom
- Right-click to pan
- Reset button to default view

**Camera Follow**
- Enable in settings
- Camera auto-adjusts to motion
- Smooth transitions

### System Prompt

**Customization**
1. Open settings
2. Edit "システムプロンプト" text area
3. Define character personality
4. Set conversation style
5. Changes apply immediately

**Example Prompts**
- Friendly assistant
- Tsundere character
- Professional companion
- Custom personality

---

## Development

### Development Mode

```bash
# Watch mode (auto-rebuild on changes)
npm run dev

# Run Electron
npm run electron
```

### Build for Production

```bash
# Build only
npm run build

# Build and package
npm run dist
```

### Project Scripts

```json
{
  "start": "npx webpack --mode development && electron .",
  "dev": "npx webpack --watch",
  "build": "npx webpack --mode production",
  "electron": "electron .",
  "dist": "npm run build && electron-builder"
}
```

### Adding New Features

**New AI Tool (Function)**
1. Define tool in `src/services/tools.js`
2. Add to `toolDefinitions` array
3. Implement executor in `toolExecutor`
4. Tool auto-available to AI

**New Animation**
1. Place VRMA file in `public/animations/`
2. Or import via drag-and-drop
3. Animation auto-loads in library

**New Voice**
- VOICEVOX voices auto-discovered
- MoeTTS requires localStorage flag

### Debugging

**Console Logs**
- `[AI]` - AI service logs
- `[TTS]` - Text-to-speech logs
- `[VAD]` - Voice activity detection logs
- `[VRM]` - VRM model logs
- `[MMD]` - MMD model logs
- `[License]` - License verification logs

**Chrome DevTools**
- Press F12 or Cmd+Option+I
- Full Chrome DevTools available
- React DevTools extension supported

---

## API Reference

### aiService

```javascript
// Initialize AI service
await aiService.initialize(apiKey, systemPrompt, progressCallback);

// Send message
const response = await aiService.sendMessage(userMessage);

// Update system prompt
aiService.updateSystemPrompt(newPrompt);

// Destroy service
aiService.destroy();
```

### voicevoxService

```javascript
// Initialize
await voicevoxService.initialize();

// Get available voices
const styles = voicevoxService.getAllStyles();

// Synthesize speech
await voicevoxService.speak(text, {
  speaker: 'ずんだもん (ノーマル)',
  speedScale: 1.0,
  pitchScale: 0.0,
  intonationScale: 1.0
});
```

### voiceRecorder

```javascript
// Start recording with VAD
await voiceRecorder.startRecordingWithVADv3(
  onResult,      // Whisper result callback
  onError,       // Error callback
  {
    onVoskRecognition: (transcript) => {},  // Wake word callback
    isConversationMode: () => boolean       // Mode check function
  }
);

// Stop recording
voiceRecorder.stopRecording();
```

### licenseApi

```javascript
// Set license key
licenseApi.setLicense(licenseKey);

// Verify license
const result = await licenseApi.verifyLicense();

// Check validity
const isValid = licenseApi.hasValidLicense();

// Get license info
const info = licenseApi.getLicenseInfo();
```

---

## System Requirements

### Minimum Requirements
- OS: Windows 10/11 (64-bit), macOS 10.15+
- RAM: 8GB
- GPU: WebGL 2.0 compatible
- Disk: 2GB free space
- Internet: Required for AI features

### Recommended Requirements
- RAM: 16GB
- GPU: Dedicated graphics card
- CPU: Intel Core i5 / AMD Ryzen 5 or better
- Display: 1920x1080 or higher
- Internet: Broadband connection

### Performance

**Memory Usage**
- Idle: ~500MB
- With model loaded: ~1-2GB
- During conversation: ~1.5-2.5GB

**CPU Usage**
- Idle: 5-10%
- During conversation: 20-30%
- Physics simulation: +10-15%

**Disk Usage**
- Application: ~600MB
- Models & animations: included
- User data (IndexedDB): varies

---

## License

Copyright 2025 miu-chang (miu sekiguchi). All rights reserved.

### Terms of Use
- Personal and commercial use is permitted
- Redistribution of the application itself is prohibited
- Reverse engineering, decompilation, and disassembly are prohibited
- Use for illegal activities is strictly forbidden

### Privacy Policy
- Conversation data is stored locally only
- User input is sent to OpenAI API for response generation
- Voice data is processed locally for speech recognition
- License key information is stored for authentication purposes
- No personal data is collected or shared without consent

### Open Source Licenses

This application uses the following open-source software:

- **Electron** - MIT License
- **React** - MIT License
- **Three.js** - MIT License
- **@pixiv/three-vrm** - MIT License
- **mmd-parser** - MIT License
- **ammojs-typed** - MIT License
- **@ricky0123/vad-web** - MIT License
- **vosk-browser** - Apache 2.0 License

Full license texts available in application under Settings → About → Licenses.

---

## Credits

### 3D Models

**Alicia Solid (Niconico Tachie-chan)**
- Copyright: Dwango Co., Ltd.
- License: Personal/Commercial use allowed (excluding corporations), modifications allowed
- Credit: Not required
- Official: https://3d.nicovideo.jp/alicia/

### Text-to-Speech

**VOICEVOX**
- Engine: Hiroshiba Kazuyuki
- License: Commercial and non-commercial use allowed
- Credit required: "VOICEVOX: [Character Name]"
- Characters: 100+ voices including:
  - ずんだもん (Zundamon)
  - 四国めたん (Shikoku Metan)
  - 春日部つむぎ (Kasukabe Tsumugi)
  - 猫使ビィ (Neko Tsuka Bii)
  - 東北きりたん (Tohoku Kiritan)
  - And many more
- Official: https://voicevox.hiroshiba.jp/

### Animations

**Mixamo Animations**
- Source: Adobe Mixamo
- Converted to VRMA format
- 64 animations included

**MMD Motions**
- Various motion creators
- 17 VMD files included
- Each motion has individual terms

### Development

**Developer**: miu-chang (miu sekiguchi)
- Email: weiyu.illustration2002@gmail.com
- Discord: https://discord.gg/fsZaFkDDrU
- GitHub: https://github.com/miu-chang/Kawaii_Agent

---

## Contact & Support

### Support Channels

- **Email**: weiyu.illustration2002@gmail.com
- **Discord Server**: https://discord.gg/fsZaFkDDrU
- **GitHub Issues**: https://github.com/miu-chang/Kawaii_Agent/issues

### Frequently Asked Questions

**Q: Do I need an OpenAI API key?**
A: Not for BOOTH version. Only open source version requires your own API key.

**Q: Can I use it offline?**
A: No, AI features (conversation, speech recognition) require internet connection.

**Q: Can I use my own VRM model?**
A: Yes, drag and drop your VRM file into the window.

**Q: Is commercial use of VOICEVOX voices allowed?**
A: Yes, with proper credit attribution according to each character's terms.

**Q: Does it work on macOS?**
A: Yes, macOS 10.15 and later are supported.

**Q: Is GPU required?**
A: WebGL 2.0 capable GPU is required. Integrated GPU works, but dedicated GPU recommended.

**Q: How fast are AI responses?**
A: Typically 1-3 seconds, depending on network and API load.

**Q: How many PCs can I use with one license?**
A: License is per user. Contact support for multi-device usage.

**Q: Can I customize character personality?**
A: Yes, edit the system prompt in settings to define any personality.

**Q: What languages does the AI support?**
A: Primarily Japanese, but GPT-4.1 mini supports multiple languages. TTS is Japanese only (VOICEVOX).

### Known Issues

- Large MMD models (100MB+) may take time to load
- Some MMD models may have unstable physics
- macOS may show security warning on first launch (allow in Settings)
- VAD may have false positives in noisy environments

### Roadmap

Future features being considered:
- Multi-language UI
- More TTS engine options
- Local LLM support
- VTuber mode (virtual camera output)
- Mobile companion app
- Custom animation editor

---

## Changelog

### Version 1.0.0 (January 2025)
- Initial release
- GPT-4.1 mini integration
- VRM and MMD model support
- VOICEVOX TTS integration
- 64 VRMA animations included
- 17 MMD VMD motions included
- Physics simulation with Ammo.js
- Wake word detection
- Function calling (web search, weather, news)
- License system implementation
- Auto-talk feature
- Tap interactions
- Pet mode
- IndexedDB storage
- Customizable prompts

---

For detailed BOOTH sales information, see [BOOTH_DESCRIPTION.md](BOOTH_DESCRIPTION.md).

For technical implementation details and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon).
