# Kawaii Agent

AI搭載のデスクトップコンパニオン / AI-powered Desktop Companion / AI桌面伴侣

---

## 📌 重要：2つのバージョンについて / About Two Versions / 关于两个版本

### 🎯 日本語

このリポジトリには**2つの使い方**があります：

**1. オープンソース版（Git版）**
- このリポジトリからソースコードをビルド
- **ライセンス不要**
- **自分のOpenAI APIキーが必要**（有料）
- 開発者・上級者向け
- カスタマイズ自由

**2. パッケージ版（BOOTH販売）**
- ビルド済みアプリケーション
- **ライセンスキーが必要**（BOOTHで購入）
- **OpenAI APIキー不要**（バックエンド経由で提供）
- 一般ユーザー向け
- すぐに使える

### 🎯 English

This repository offers **two ways to use**:

**1. Open Source Version (Git)**
- Build from source code in this repository
- **No license required**
- **Your own OpenAI API key required** (paid)
- For developers and advanced users
- Fully customizable

**2. Packaged Version (BOOTH)**
- Pre-built application
- **License key required** (purchase from BOOTH)
- **No OpenAI API key needed** (provided via backend)
- For general users
- Ready to use

### 🎯 中文

本仓库提供**两种使用方式**：

**1. 开源版（Git版）**
- 从本仓库构建源代码
- **无需许可证**
- **需要自己的OpenAI API密钥**（付费）
- 面向开发者和高级用户
- 可自由定制

**2. 打包版（BOOTH销售）**
- 预构建应用程序
- **需要许可证密钥**（从BOOTH购买）
- **无需OpenAI API密钥**（通过后端提供）
- 面向普通用户
- 即开即用

---

## Features

### Character Support
- **VRM models** - Standard VRM format with full expression control
- **MMD (MikuMikuDance) models** - PMX format with physics simulation
- **Animations** - VRMA, VMD, and BVH format support
- **Interactive physics** - Touch interactions with realistic physics response

### AI Conversation
- **GPT-4.1 mini integration** - Natural language conversation
- **Emotion detection** - Automatic facial expression based on conversation
- **Voice interaction** - Voice input/output with wake word detection
- **Function calling** - Web search, weather, news, and more

### Voice & TTS
- **VOICEVOX** - High-quality Japanese TTS (commercial use OK)
- **Multiple voices** - 100+ character voices available
- **Voice customization** - Speed, pitch, and intonation control
- **Multilingual support** - Japanese, English, Chinese, Korean

### Advanced Features
- **Always-on voice detection** - Hands-free wake word activation
- **Auto-talk mode** - Periodic conversation initiation
- **Gesture system** - Dynamic body language during conversation
- **Motion library** - 60+ animations with custom import support
- **Tap interactions** - Body-part specific reactions

## System Requirements

- **OS**: Windows 10/11, macOS 10.15+
- **RAM**: 8GB minimum, 16GB recommended
- **GPU**: WebGL 2.0 compatible
- **Disk**: 2GB free space

## Installation

### Option 1: Pre-built Package (BOOTH Version)
**For general users - Recommended**

1. Purchase license key from BOOTH
2. Download the application package
3. Launch and enter your license key
4. No API key required - AI features work immediately

**Advantages:**
- No OpenAI API key needed
- Backend handles all API calls
- Simple setup for non-technical users
- Regular updates and support

### Option 2: Build from Source (Open Source Version)
**For developers and advanced users**

```bash
# Clone repository
git clone https://github.com/miu-chang/Kawaii_Agent.git
cd Kawaii_Agent

# Install dependencies
npm install

# Build
npm run build

# Run development mode
npm start
```

**Requirements for source build:**
- Your own OpenAI API key (required for AI features)
- No license key needed
- Self-hosted and customizable

## Configuration

### BOOTH Version (Licensed)
- License key: Purchased from BOOTH
- OpenAI API: Provided via backend (no API key needed)
- Updates: Automatic with package

### Open Source Version (Self-hosted)
- License key: Not required
- OpenAI API key: **Required** - Enter your own key in settings
- News API key: Optional, for news function
- Updates: Manual git pull and rebuild

## Usage

### First Launch
1. Enter your license key
2. Wait for AI initialization (models download on first run)
3. Click "AI初期化" to start the AI service

### Voice Commands
Say the wake word (default: "アリシア") to start conversation mode.
Conversation mode automatically ends after 20 minutes of inactivity.

### Model Import
- Drag and drop VRM/PMX files into the window
- Drag and drop VMD/VRMA files for custom animations
- Models and motions are saved locally in IndexedDB

## Development

### Project Structure
```
src/
  ├── components/     # React components
  ├── services/       # AI, TTS, voice services
  ├── utils/          # Helper utilities
  └── App.jsx         # Main application

public/
  ├── animations/     # VRMA animation files
  ├── models/         # Default VRM/MMD models
  └── モーション/      # MMD VMD files
```

### Technology Stack
- Electron + React
- Three.js + React Three Fiber
- @pixiv/three-vrm (VRM support)
- MMDLoader (MMD support)
- OpenAI API (GPT-4.1 mini)
- VOICEVOX (TTS)

## License

Copyright © 2025 miu-chang (miu sekiguchi). All rights reserved.

### Terms of Use
- Personal and commercial use is permitted
- Redistribution of the application itself is prohibited
- Reverse engineering, decompilation, and disassembly are prohibited

### Privacy Policy
- Conversation data is stored locally only
- User input is sent to OpenAI API for response generation
- Voice data is processed locally for speech recognition
- License key information is stored for authentication

## Open Source Licenses

This application uses the following open-source software:

- **Electron** - MIT License
- **React** - MIT License
- **Three.js** - MIT License
- **@pixiv/three-vrm** - MIT License
- **mmd-parser** - MIT License
- **ammojs-typed** - MIT License (Physics engine)

## 3D Model Credits

### Alicia Solid (Niconico Tachie-chan)
© Dwango Co., Ltd.
- License: Personal/Commercial use allowed (excluding corporations), modifications allowed
- Credit attribution: Not required
- Official: https://3d.nicovideo.jp/alicia/

### VOICEVOX
- **Engine**: Hiroshiba Kazuyuki
- **License**: Commercial and non-commercial use allowed
- **Credit required**: "VOICEVOX: [Character Name]"
- **Characters**: 100+ voices including Zundamon, Shikoku Metan, Tsumugi Kasukabe, etc.
- Official: https://voicevox.hiroshiba.jp/

### Animations
- Mixamo (Adobe)
- Custom animations

## Contact & Support

- **Email**: weiyu.illustration2002@gmail.com
- **Discord**: https://discord.gg/fsZaFkDDrU
- **GitHub Issues**: https://github.com/miu-chang/Kawaii_Agent/issues

For detailed terms of use, privacy policy, and license information, please refer to the "About" section in the application settings.
