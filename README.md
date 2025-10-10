# Kawaii Agent

AI-powered desktop companion with VRM/MMD character support.

## Features

### Character Support
- **VRM models** - Standard VRM format with full expression control
- **MMD (MikuMikuDance) models** - PMX format with physics simulation
- **Animations** - VRMA, VMD, and BVH format support
- **Interactive physics** - Touch interactions with realistic physics response

### AI Conversation
- **GPT-4o integration** - Natural language conversation
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

### Option 1: Use Pre-built Package (Recommended)
1. Download the latest release
2. Extract and run the executable
3. Enter your license key when prompted

### Option 2: Build from Source

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

## Configuration

### License
This application requires a valid license key. Purchase at [license URL].

### API Keys
Some features require external API keys (stored locally):
- OpenAI API key (optional, for direct API access)
- News API key (optional, for news function)

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
- OpenAI API (GPT-4o)
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
