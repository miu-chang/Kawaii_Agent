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

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [API Reference](#api-reference)
- [License](#license)
- [Credits](#credits)

---

## Overview

Kawaii Agent is an advanced AI-powered desktop companion that combines cutting-edge conversational AI with highly expressive 3D character models. Built on Electron and React, it provides a seamless experience for interacting with virtual characters through natural language processing, voice recognition, and physics-based animations.

### Key Highlights

- GPT-4.1 mini integration for natural conversations
- VRM and MMD (MikuMikuDance) model support
- 64 VRMA animations + 17 MMD motions included
- VOICEVOX TTS with 100+ character voices
- Real-time emotion detection and expression control
- Wake word detection for hands-free interaction
- Physics-based animation using Ammo.js
- Function calling (web search, weather, news)
- Fully customizable character and behavior

---

## Features

### AI Conversation System

**Natural Language Processing**
- Model: GPT-4.1 mini (OpenAI)
- Context-aware conversations with memory
- Emotion detection from text (7 emotions: joy, sadness, anger, surprise, fear, disgust, neutral)
- System prompt customization
- Conversation history management

**Voice Interaction**
- Speech recognition: Whisper API (OpenAI)
- Wake word detection: customizable keywords (default: "アリシア")
- Voice Activity Detection (VAD): @ricky0123/vad-web
- Continuous conversation mode with 20-minute sessions
- Real-time audio processing

**Function Calling**
- Web search (Google integration)
- Weather information (OpenWeatherMap API)
- News retrieval (NewsAPI)
- Time/date queries
- Calculator functions
- Extensible tool system

### 3D Character Support

**VRM Models**
- Standard VRM format support (@pixiv/three-vrm 3.4.2)
- Full BlendShape control for facial expressions
- Automatic expression mapping
- Eye tracking and blinking
- Lip sync capability
- Custom VRM model import via drag-and-drop

**MMD (MikuMikuDance) Models**
- PMX format support (mmd-parser)
- Physics simulation with Ammo.js
- Realistic hair, skirt, and accessory physics
- VMD motion playback
- Material and texture rendering
- Skinning weight support

**Included Model**
- Alicia Solid (Niconico Tachie-chan)
- Copyright: Dwango Co., Ltd.
- License: Personal/commercial use allowed (excluding corporations)

### Animation System

**Included Animations**
- 64 VRMA animations (converted from Mixamo)
- 17 MMD VMD motions
- Idle animations with automatic rotation
- Gesture system linked to conversation
- Custom animation import (VRMA, VMD, BVH formats)
- Animation blending and transitions

**Animation Categories**
- Idle: standing, sitting, sleeping
- Emotional: happy, sad, excited, crying
- Actions: walking, running, waving, clapping
- Interactions: greeting, thinking, typing
- Special: dancing, swimming, turning

### Text-to-Speech (TTS)

**VOICEVOX Integration**
- 100+ high-quality Japanese voices
- Popular characters: Zundamon, Shikoku Metan, Tsumugi Kasukabe, Neko Tsuka Bii
- Voice customization: speed, pitch, intonation
- Commercial use allowed (with proper credit)
- Real-time audio generation
- Audio caching for performance

**Voice Parameters**
- Speed scale: 0.5x - 2.0x
- Pitch scale: -0.15 - 0.15
- Intonation scale: 0.0 - 2.0

### Interactive Features

**Tap Interactions**
- Body part recognition (head, shoulder, arm, leg, intimate zones)
- GPT-5 nano automatic bone category detection
- Part-specific reactions and responses
- Physics response on tap
- Customizable reaction prompts per body part

**Pet Mode**
- Long-press to activate petting
- Gentle stroking animations
- Affectionate responses
- Happiness indicators

**Camera Controls**
- Mouse follow: character eyes track cursor
- Camera follow: auto-adjust to character movement
- Manual camera: drag to rotate view
- FOV adjustment: zoom in/out
- Transparent background mode

### Physics Simulation

**Ammo.js Integration**
- 256MB heap memory allocation
- MMDPhysics support
- Realistic hair, clothing, and accessory movement
- Collision detection
- Gravity and wind simulation
- Simple physics mode for lower-end devices

### Auto-Talk Feature

- Configurable interval (5-60 minutes)
- Random topic generation
- Customizable prompt templates
- Enable/disable toggle
- Independent from conversation mode

### Data Management

**IndexedDB Storage**
- Imported models and motions
- User preferences and settings
- Favorite models and animations
- Conversation history
- Custom prompts

**Import/Export**
- Drag-and-drop model import
- Drag-and-drop motion import
- Favorite management
- Settings backup and restore

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
