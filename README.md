# Kawaii Agent

AI搭載のデスクトップコンパニオン / AI-powered Desktop Companion / AI桌面伴侣

[日本語](#日本語) | [English](#english) | [中文](#中文)

---

<a id="日本語"></a>
# 日本語

## 概要

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

## 重要：2つのバージョンについて

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

## 目次

- [主な機能](#主な機能)
- [TTS Mod 開発ガイド](#tts-mod-開発ガイド)
- [インストール](#インストール)
- [システム要件](#システム要件)
- [使い方](#使い方)
- [開発](#開発)
- [ライセンス](#ライセンス)
- [クレジット](#クレジット)
- [お問い合わせ](#お問い合わせ)

## 主な機能

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

## TTS Mod 開発ガイド

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

### サンプルMod

完全なサンプルは以下のリポジトリを参照してください：

https://github.com/miu-chang/kawaii-agent-tts-mod-sample

## インストール

### オプション1: パッケージ版（BOOTH版）

**一般ユーザー向け - 推奨**

1. BOOTHでライセンスキーを購入
2. アプリケーションパッケージをダウンロード
3. 解凍して実行ファイルを起動
4. 表示されたらライセンスキーを入力
5. 追加設定不要

**利点:**
- OpenAI APIキー不要
- バックエンドが全てのAPI呼び出しを処理
- 技術知識不要の簡単セットアップ
- 定期的な更新とサポート
- すぐに使える

### オプション2: ソースからビルド（オープンソース版）

**開発者・上級者向け**

#### 必要環境
- Node.js 18.x以上
- npm 9.x以上
- Git

#### リポジトリをクローン

```bash
git clone https://github.com/miu-chang/Kawaii_Agent.git
cd Kawaii_Agent
```

#### 依存関係をインストール

```bash
npm install
```

#### ビルド

```bash
# 開発ビルド
npm run build

# 本番ビルド
npm run build

# Electronを起動
npm start
```

#### 環境変数

`.env`ファイルを作成：

```env
# オープンソース版には必須
OPENAI_API_KEY=your_openai_api_key_here

# オプション: ニュース機能
NEWS_API_KEY=your_news_api_key_here
```

**注意:** オープンソース版は自分のOpenAI APIキーが必要です。https://platform.openai.com/api-keys で取得してください。

## システム要件

### 最小要件
- OS: Windows 10/11 (64-bit), macOS 10.15+
- RAM: 8GB
- GPU: WebGL 2.0対応
- ディスク: 2GB空き容量
- インターネット: AI機能に必要

### 推奨要件
- RAM: 16GB
- GPU: 専用グラフィックカード
- CPU: Intel Core i5 / AMD Ryzen 5以上
- ディスプレイ: 1920x1080以上
- インターネット: ブロードバンド接続

### パフォーマンス

**メモリ使用量**
- アイドル: ~500MB
- モデル読み込み時: ~1-2GB
- 会話中: ~1.5-2.5GB

**CPU使用率**
- アイドル: 5-10%
- 会話中: 20-30%
- 物理シミュレーション: +10-15%

**ディスク使用量**
- アプリケーション: ~600MB
- モデル・アニメーション: 含まれる
- ユーザーデータ（IndexedDB）: 可変

## 使い方

### 初回起動

1. アプリケーションを起動
2. ライセンス/APIキー入力画面が表示
3. 認証情報を入力
4. 「AI初期化」をクリックしてAIを初期化
5. モデル読み込みの進行を待つ
6. 初期挨拶が表示される

### 基本的な会話

**テキスト入力**
- チャット入力欄にメッセージを入力
- Enterを押すか送信ボタンをクリック
- AIが音声とアニメーションで応答

**音声入力**
- マイクボタンをクリック
- メッセージを話す
- 完了したら停止をクリック
- Whisperが文字起こしして、AIに送信

### ウェイクワード検出

**設定**
1. 設定で「音声検出を常時ON」を有効化
2. ウェイクワードを設定（デフォルト: "アリシア"）
3. AI初期化で聞き取り開始

**使用方法**
- ウェイクワードを言う: "アリシア"
- 会話モードが有効化（20分間）
- ボタンを押さずに自然に話せる
- タイムアウト後に自動終了

### キャラクターインタラクション

**タップインタラクション**
- キャラクターの体の部位をクリック
- 場所に応じてAIが反応
- 物理演算がタップに反応
- 部位ごとの反応カスタマイズ可能

**撫でモード**
- キャラクターを長押ししてドラッグ
- 撫でアニメーション再生
- 愛情のこもった反応
- 複数の撫でプロンプト

### モデルのインポート

**VRMモデル**
- VRMファイルをウィンドウにドラッグ
- モデルが自動的に読み込まれる
- IndexedDBに保存
- 設定でモデル切り替え

**MMDモデル**
- PMXファイルをウィンドウにドラッグ
- テクスチャ自動検出
- 物理シミュレーション適用
- 再利用のため保存

**アニメーション**
- VRMA/VMD/BVHファイルをウィンドウにドラッグ
- アニメーションがライブラリにインポート
- アニメーションリストから再生
- クイックアクセス用にお気に入り登録

### 音声カスタマイズ

**VOICEVOX設定**
1. 設定パネルを開く
2. 「TTSエンジン」→ VOICEVOXを選択
3. 100種以上の声からキャラクターを選択
4. 速度、ピッチ、抑揚を調整
5. プレビューボタンでテスト

**音声検索**
- 検索ボックスにキャラクター名を入力
- 100種以上の声からフィルタ
- 選択前にプレビュー

### カメラコントロール

**マウス追従**
- 設定で有効化
- キャラクターの目がカーソルを追跡
- 自然な視線の動き

**手動カメラ**
- ドラッグで視点回転
- スクロールでズーム
- 右クリックでパン
- リセットボタンでデフォルト視点に戻る

**カメラ追従**
- 設定で有効化
- カメラがモーションに自動調整
- スムーズな遷移

### システムプロンプト

**カスタマイズ**
1. 設定を開く
2. 「システムプロンプト」テキストエリアを編集
3. キャラクターの性格を定義
4. 会話スタイルを設定
5. 変更は即座に適用

**プロンプト例**
- フレンドリーなアシスタント
- ツンデレキャラクター
- プロフェッショナルなコンパニオン
- カスタムパーソナリティ

## 開発

### 開発モード

```bash
# ウォッチモード（変更時に自動リビルド）
npm run dev

# Electron実行
npm run electron
```

### 本番ビルド

```bash
# ビルドのみ
npm run build

# ビルドとパッケージ化
npm run dist
```

### プロジェクトスクリプト

```json
{
  "start": "npx webpack --mode development && electron .",
  "dev": "npx webpack --watch",
  "build": "npx webpack --mode production",
  "electron": "electron .",
  "dist": "npm run build && electron-builder"
}
```

### 新機能の追加

**新しいAIツール（Function）**
1. `src/services/tools.js`でツールを定義
2. `toolDefinitions`配列に追加
3. `toolExecutor`でエグゼキュータを実装
4. ツールは自動的にAIで利用可能に

**新しいアニメーション**
1. VRMAファイルを`public/animations/`に配置
2. またはドラッグ&ドロップでインポート
3. アニメーションがライブラリに自動読み込み

**新しい音声**
- VOICEVOX音声は自動検出

### デバッグ

**コンソールログ**
- `[AI]` - AIサービスログ
- `[TTS]` - テキスト音声合成ログ
- `[VAD]` - 音声アクティビティ検出ログ
- `[VRM]` - VRMモデルログ
- `[MMD]` - MMDモデルログ
- `[License]` - ライセンス検証ログ

**Chrome DevTools**
- F12またはCmd+Option+Iを押す
- 完全なChrome DevToolsが利用可能
- React DevTools拡張機能サポート

## アーキテクチャ

### 技術スタック

**フロントエンド**
- Framework: Electron 38.2.0
- UI Library: React 19.2.0
- 3D Rendering: Three.js 0.170.0
- React Three: @react-three/fiber 9.3.0
- VRM Support: @pixiv/three-vrm 3.4.2
- MMD Parser: mmd-parser 1.0.4
- Physics: ammojs-typed 1.0.6

**バックエンド (Vercel)**
- Node.js serverless functions
- Vercel Postgres database
- License verification API
- OpenAI API proxy

**AIサービス**
- OpenAI GPT-4.1 mini (会話)
- OpenAI GPT-5 nano (感情検出、ボーン分類)
- OpenAI Whisper (音声認識)
- VOICEVOX (テキスト音声合成)

### プロジェクト構造

```
kawaii-agent/
├── src/
│   ├── main.js              # Electronメインプロセス
│   ├── preload.js           # IPCブリッジ
│   ├── renderer.js          # Reactエントリーポイント
│   ├── App.jsx              # メインアプリケーションコンポーネント
│   ├── components/
│   │   ├── VRMViewer.jsx    # 3Dキャラクターレンダラー
│   │   ├── LicenseModal.jsx # ライセンス入力モーダル
│   │   └── AboutModal.jsx   # Aboutダイアログ
│   ├── services/
│   │   ├── aiService.js           # AI会話管理
│   │   ├── licenseApi.js          # ライセンスAPIクライアント
│   │   ├── voicevoxService.js     # TTS統合
│   │   ├── voiceRecorder.js       # 音声録音・VAD
│   │   ├── speechRecognition.js   # ウェイクワード検出
│   │   ├── replicateService.js    # Replicate APIクライアント
│   │   ├── tools.js               # Function callingツール
│   │   ├── localMotionAI.js       # モーション制御
│   │   └── voicePrintService.js   # 音声分析
│   └── utils/
│       ├── vrmMotions.js          # VRMアニメーションヘルパー
│       ├── vrmGestures.js         # ジェスチャーシステム
│       ├── vrmIdleAnimations.js   # アイドルアニメーション管理
│       ├── vrmaLoader.js          # VRMAアニメーションローダー
│       ├── indexedDB.js           # ローカルストレージ
│       └── math.js                # 数学ユーティリティ
├── public/
│   ├── animations/           # 64 VRMAファイル
│   ├── models/              # デフォルトVRM/MMDモデル
│   ├── モーション/            # 17 MMD VMDファイル
│   └── *.wasm               # ONNX Runtime WebAssembly
├── dist/                    # Webpackビルド出力 (562MB)
├── .env                     # 環境変数
├── webpack.config.js        # Webpack設定
└── package.json            # 依存関係とスクリプト
```

### サービスモジュール（11ファイル）

1. **aiService.js** - コアAI会話ロジック、感情検出、function calling
2. **licenseApi.js** - ライセンス検証、バックエンドAPI通信
3. **voicevoxService.js** - VOICEVOX TTS統合、音声合成
4. **voiceRecorder.js** - 音声録音、VAD、音声処理
5. **speechRecognition.js** - ウェイクワード検出、Whisper API呼び出し
6. **replicateService.js** - Replicate API統合（将来のモデル用）
7. **tools.js** - Function callingツール定義（検索、天気、ニュース）
8. **localMotionAI.js** - アニメーション選択用ローカルモーションAI
9. **voicePrintService.js** - 音声フィンガープリント分析
10. **umaVoiceService.js** - ウマ娘音声（レガシー）

## ライセンス

Copyright 2025 miu-chang (miu sekiguchi). All rights reserved.

### 利用規約
- 個人利用・商用利用可
- アプリケーション自体の再配布禁止
- リバースエンジニアリング、逆コンパイル、逆アセンブル禁止
- 違法行為への使用厳禁

### プライバシーポリシー
- 会話データはローカルにのみ保存
- ユーザー入力は応答生成のためOpenAI APIに送信
- 音声データは音声認識のためローカル処理
- ライセンスキー情報は認証目的で保存
- 個人データは同意なしに収集・共有されません

### オープンソースライセンス

このアプリケーションは以下のオープンソースソフトウェアを使用しています：

- **Electron** - MIT License
- **React** - MIT License
- **Three.js** - MIT License
- **@pixiv/three-vrm** - MIT License
- **mmd-parser** - MIT License
- **ammojs-typed** - MIT License
- **@ricky0123/vad-web** - ISC License (Voice Activity Detection)
- **vosk-browser** - Apache 2.0 License

完全なライセンステキストはアプリケーション内の 設定 → About → Licenses で確認できます。

## クレジット

### 3Dモデル

**Alicia Solid (ニコニコ立ち絵ちゃん)**
- 著作権: 株式会社ドワンゴ
- ライセンス: 個人/商用利用可（法人除く）、改変可
- クレジット表記: 不要
- 公式: https://3d.nicovideo.jp/alicia/

### テキスト音声合成

**VOICEVOX**
- エンジン: ヒロシバ カズユキ
- ライセンス: 商用・非商用利用可
- クレジット必須: "VOICEVOX: [キャラクター名]"
- キャラクター: 100種以上の声を含む:
  - ずんだもん (Zundamon)
  - 四国めたん (Shikoku Metan)
  - 春日部つむぎ (Kasukabe Tsumugi)
  - 猫使ビィ (Neko Tsuka Bii)
  - 東北きりたん (Tohoku Kiritan)
  - その他多数
- 公式: https://voicevox.hiroshiba.jp/

### アニメーション

**Mixamoアニメーション**
- ソース: Adobe Mixamo
- VRMA形式に変換
- 64アニメーション収録

**MMDモーション**
- 音街ウナ公式モーション © MTK INTERNET Co., Ltd. - 商用利用についてはガイドライン参照
  - 公式サイト: https://otomachiuna.jp/
- むつごろう様 - ぼんやり待ちループ、ご機嫌ループ、会話モーション等
  - ニコニ立体: https://3d.nicovideo.jp/users/2603791
- 様々なMMDモーション作成者様の作品
- 17 VMDファイル収録
- 各モーションは個別の利用規約に従います
- 詳細: https://3d.nicovideo.jp/

### 開発

**開発者**: miu-chang (miu sekiguchi)
- Email: weiyu.illustration2002@gmail.com
- Discord: https://discord.gg/fsZaFkDDrU
- GitHub: https://github.com/miu-chang/Kawaii_Agent

## お問い合わせ

### サポートチャンネル

- **Email**: weiyu.illustration2002@gmail.com
- **Discord Server**: https://discord.gg/fsZaFkDDrU
- **GitHub Issues**: https://github.com/miu-chang/Kawaii_Agent/issues

### よくある質問

**Q: OpenAI APIキーは必要ですか？**
A: BOOTH版は不要です。オープンソース版のみ自分のAPIキーが必要です。

**Q: オフラインで使えますか？**
A: いいえ、AI機能（会話、音声認識）にはインターネット接続が必要です。

**Q: 自分のVRMモデルを使えますか？**
A: はい、VRMファイルをウィンドウにドラッグ&ドロップしてください。

**Q: VOICEVOX音声の商用利用は可能ですか？**
A: はい、各キャラクターの利用規約に従って適切なクレジット表記を行えば可能です。

**Q: macOSで動作しますか？**
A: はい、macOS 10.15以降をサポートしています。

**Q: GPUは必要ですか？**
A: WebGL 2.0対応GPUが必要です。統合GPUでも動作しますが、専用GPUを推奨します。

**Q: AI応答速度はどのくらいですか？**
A: 通常1-3秒程度ですが、ネットワークとAPI負荷により変動します。

**Q: 1つのライセンスで何台のPCで使えますか？**
A: ライセンスはユーザーごとです。複数デバイスでの使用についてはサポートにお問い合わせください。

**Q: キャラクターの性格をカスタマイズできますか？**
A: はい、設定のシステムプロンプトを編集して任意の性格を定義できます。

**Q: AIは何語に対応していますか？**
A: 主に日本語ですが、GPT-4.1 miniは多言語対応です。TTSは日本語のみ（VOICEVOX）。

### 既知の問題

- 大きなMMDモデル（100MB+）は読み込みに時間がかかる場合があります
- 一部のMMDモデルは物理演算が不安定な場合があります
- macOSでは初回起動時にセキュリティ警告が表示される場合があります（設定で許可してください）
- VADはノイズの多い環境で誤検出する場合があります

### ロードマップ

検討中の将来機能：
- 多言語UI
- より多くのTTSエンジンオプション
- ローカルLLMサポート
- VTuberモード（仮想カメラ出力）
- モバイルコンパニオンアプリ
- カスタムアニメーションエディター

## 変更履歴

### Version 1.0.0 (2025年10月)
- 初回リリース
- GPT-4.1 mini統合
- VRMおよびMMDモデルサポート
- VOICEVOX TTS統合
- 64 VRMAアニメーション収録
- 17 MMD VMDモーション収録
- Ammo.jsによる物理シミュレーション
- ウェイクワード検出
- Function calling（Web検索、天気、ニュース）
- ライセンスシステム実装
- オートトーク機能
- タップインタラクション
- 撫でモード
- IndexedDBストレージ
- カスタマイズ可能なプロンプト

---
---
---

<a id="english"></a>
# English

## Overview

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

## Important: About Two Versions

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

## Table of Contents

- [Features](#features)
- [TTS Mod Development Guide](#tts-mod-development-guide)
- [Installation](#installation)
- [System Requirements](#system-requirements)
- [Usage](#usage)
- [Development](#development)
- [License](#license)
- [Credits](#credits)
- [Contact & Support](#contact--support)

## Features

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

## TTS Mod Development Guide

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

### Sample Mod

For a complete sample, refer to the following repository:

https://github.com/miu-chang/kawaii-agent-tts-mod-sample

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
```

**Note:** Open Source version requires your own OpenAI API key. Get one at https://platform.openai.com/api-keys

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
│   │   └── voicePrintService.js   # Voice analysis
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
10. **umaVoiceService.js** - Uma Musume voices (legacy)

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
- **@ricky0123/vad-web** - ISC License (Voice Activity Detection)
- **vosk-browser** - Apache 2.0 License

Full license texts available in application under Settings → About → Licenses.

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
- Otomachi Una Official Motion © MTK INTERNET Co., Ltd. - See guidelines for commercial use
  - Official Site: https://otomachiuna.jp/
- Mutsugoro - Idle loops, conversation motions, etc.
  - Niconico 3D: https://3d.nicovideo.jp/users/2603791
- Various MMD motion creators' works
- 17 VMD files included
- Each motion follows individual terms of use
- Details: https://3d.nicovideo.jp/

### Development

**Developer**: miu-chang (miu sekiguchi)
- Email: weiyu.illustration2002@gmail.com
- Discord: https://discord.gg/fsZaFkDDrU
- GitHub: https://github.com/miu-chang/Kawaii_Agent

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

## Changelog

### Version 1.0.0 (October 2025)
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
---
---

<a id="中文"></a>
# 中文

## 概述

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

## 重要：关于两个版本

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

## 目录

- [主要功能](#主要功能-1)
- [TTS Mod 开发指南](#tts-mod-开发指南-1)
- [安装](#安装)
- [系统要求](#系统要求)
- [使用方法](#使用方法)
- [开发](#开发-1)
- [许可证](#许可证)
- [制作人员](#制作人员)
- [联系与支持](#联系与支持)

## 主要功能

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

## TTS Mod 开发指南

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

### 示例Mod

完整示例请参考以下仓库：

https://github.com/miu-chang/kawaii-agent-tts-mod-sample

## 安装

### 选项1：预构建包（BOOTH版本）

**面向普通用户 - 推荐**

1. 从BOOTH购买许可证密钥
2. 下载应用程序包
3. 解压并运行可执行文件
4. 提示时输入许可证密钥
5. 无需额外设置

**优势：**
- 无需OpenAI API密钥
- 后端处理所有API调用
- 非技术用户的简单设置
- 定期更新和支持
- 立即可用

### 选项2：从源代码构建（开源版本）

**面向开发者和高级用户**

#### 先决条件
- Node.js 18.x或更高版本
- npm 9.x或更高版本
- Git

#### 克隆仓库

```bash
git clone https://github.com/miu-chang/Kawaii_Agent.git
cd Kawaii_Agent
```

#### 安装依赖

```bash
npm install
```

#### 构建

```bash
# 开发构建
npm run build

# 生产构建
npm run build

# 启动Electron
npm start
```

#### 环境变量

创建`.env`文件：

```env
# 开源版本必需
OPENAI_API_KEY=your_openai_api_key_here

# 可选：新闻功能
NEWS_API_KEY=your_news_api_key_here
```

**注意：** 开源版本需要您自己的OpenAI API密钥。在 https://platform.openai.com/api-keys 获取

## 系统要求

### 最低要求
- 操作系统：Windows 10/11（64位）、macOS 10.15+
- 内存：8GB
- GPU：WebGL 2.0兼容
- 磁盘：2GB可用空间
- 互联网：AI功能需要

### 推荐要求
- 内存：16GB
- GPU：专用显卡
- CPU：Intel Core i5 / AMD Ryzen 5或更好
- 显示器：1920x1080或更高
- 互联网：宽带连接

### 性能

**内存使用**
- 空闲：~500MB
- 加载模型：~1-2GB
- 对话中：~1.5-2.5GB

**CPU使用**
- 空闲：5-10%
- 对话中：20-30%
- 物理模拟：+10-15%

**磁盘使用**
- 应用程序：~600MB
- 模型和动画：已包含
- 用户数据（IndexedDB）：可变

## 使用方法

### 首次启动

1. 启动应用程序
2. 出现许可证/API密钥模态框
3. 输入凭据
4. 点击"AI初期化"初始化AI
5. 等待模型加载进度
6. 出现初始问候

### 基本对话

**文本输入**
- 在聊天输入框中输入消息
- 按Enter或点击发送按钮
- AI用语音和动画回应

**语音输入**
- 点击麦克风按钮
- 说出您的消息
- 完成后点击停止
- Whisper转录并发送给AI

### 唤醒词检测

**设置**
1. 在设置中启用"音声検出を常時ON"
2. 配置唤醒词（默认："アリシア"）
3. AI初始化开始监听

**使用**
- 说出唤醒词："アリシア"
- 对话模式激活（20分钟）
- 无需点击按钮即可自然交谈
- 超时后自动结束

### 角色交互

**点击交互**
- 点击角色身体部位
- AI根据位置做出反应
- 物理响应点击
- 每个部位可自定义反应

**抚摸模式**
- 长按并在角色上拖动
- 播放抚摸动画
- 亲切的回应
- 多个抚摸提示

### 模型导入

**VRM模型**
- 将VRM文件拖到窗口
- 模型自动加载
- 保存到IndexedDB
- 在设置中切换模型

**MMD模型**
- 将PMX文件拖到窗口
- 自动检测纹理
- 应用物理模拟
- 保存以供重用

**动画**
- 将VRMA/VMD/BVH文件拖到窗口
- 动画导入到库
- 从动画列表播放
- 收藏以快速访问

### 语音自定义

**VOICEVOX设置**
1. 打开设置面板
2. 选择"TTSエンジン"→ VOICEVOX
3. 从100+语音中选择角色
4. 调整速度、音高、语调
5. 用预览按钮测试

**语音搜索**
- 在搜索框中输入角色名称
- 从100+语音中筛选
- 选择前预览

### 相机控制

**鼠标跟随**
- 在设置中启用
- 角色眼睛跟踪光标
- 自然的注视行为

**手动相机**
- 拖动旋转视图
- 滚动缩放
- 右键平移
- 重置按钮返回默认视图

**相机跟随**
- 在设置中启用
- 相机自动调整到动作
- 平滑过渡

### 系统提示

**自定义**
1. 打开设置
2. 编辑"システムプロンプト"文本区域
3. 定义角色个性
4. 设置对话风格
5. 更改立即应用

**示例提示**
- 友好的助手
- 傲娇角色
- 专业伴侣
- 自定义个性

## 开发

### 开发模式

```bash
# 监视模式（更改时自动重建）
npm run dev

# 运行Electron
npm run electron
```

### 生产构建

```bash
# 仅构建
npm run build

# 构建和打包
npm run dist
```

### 项目脚本

```json
{
  "start": "npx webpack --mode development && electron .",
  "dev": "npx webpack --watch",
  "build": "npx webpack --mode production",
  "electron": "electron .",
  "dist": "npm run build && electron-builder"
}
```

### 添加新功能

**新AI工具（功能）**
1. 在`src/services/tools.js`中定义工具
2. 添加到`toolDefinitions`数组
3. 在`toolExecutor`中实现执行器
4. 工具自动可用于AI

**新动画**
1. 将VRMA文件放在`public/animations/`
2. 或通过拖放导入
3. 动画自动加载到库

**新语音**
- VOICEVOX语音自动发现

### 调试

**控制台日志**
- `[AI]` - AI服务日志
- `[TTS]` - 文本转语音日志
- `[VAD]` - 语音活动检测日志
- `[VRM]` - VRM模型日志
- `[MMD]` - MMD模型日志
- `[License]` - 许可证验证日志

**Chrome DevTools**
- 按F12或Cmd+Option+I
- 完整的Chrome DevTools可用
- 支持React DevTools扩展

## 架构

### 技术栈

**前端**
- Framework: Electron 38.2.0
- UI Library: React 19.2.0
- 3D Rendering: Three.js 0.170.0
- React Three: @react-three/fiber 9.3.0
- VRM Support: @pixiv/three-vrm 3.4.2
- MMD Parser: mmd-parser 1.0.4
- Physics: ammojs-typed 1.0.6

**后端（Vercel）**
- Node.js无服务器函数
- Vercel Postgres数据库
- 许可证验证API
- OpenAI API代理

**AI服务**
- OpenAI GPT-4.1 mini（对话）
- OpenAI GPT-5 nano（情感检测、骨骼分类）
- OpenAI Whisper（语音识别）
- VOICEVOX（文本转语音）

### 项目结构

```
kawaii-agent/
├── src/
│   ├── main.js              # Electron主进程
│   ├── preload.js           # IPC桥接
│   ├── renderer.js          # React入口点
│   ├── App.jsx              # 主应用程序组件
│   ├── components/
│   │   ├── VRMViewer.jsx    # 3D角色渲染器
│   │   ├── LicenseModal.jsx # 许可证输入模态框
│   │   └── AboutModal.jsx   # 关于对话框
│   ├── services/
│   │   ├── aiService.js           # AI对话管理
│   │   ├── licenseApi.js          # 许可证API客户端
│   │   ├── voicevoxService.js     # TTS集成
│   │   ├── voiceRecorder.js       # 音频录制和VAD
│   │   ├── speechRecognition.js   # 唤醒词检测
│   │   ├── replicateService.js    # Replicate API客户端
│   │   ├── tools.js               # 函数调用工具
│   │   ├── localMotionAI.js       # 动作控制
│   │   └── voicePrintService.js   # 语音分析
│   └── utils/
│       ├── vrmMotions.js          # VRM动画辅助
│       ├── vrmGestures.js         # 手势系统
│       ├── vrmIdleAnimations.js   # 空闲动画管理器
│       ├── vrmaLoader.js          # VRMA动画加载器
│       ├── indexedDB.js           # 本地存储
│       └── math.js                # 数学工具
├── public/
│   ├── animations/           # 64个VRMA文件
│   ├── models/              # 默认VRM/MMD模型
│   ├── モーション/            # 17个MMD VMD文件
│   └── *.wasm               # ONNX Runtime WebAssembly
├── dist/                    # Webpack构建输出（562MB）
├── .env                     # 环境变量
├── webpack.config.js        # Webpack配置
└── package.json            # 依赖和脚本
```

### 服务模块（11个文件）

1. **aiService.js** - 核心AI对话逻辑、情感检测、函数调用
2. **licenseApi.js** - 许可证验证、后端API通信
3. **voicevoxService.js** - VOICEVOX TTS集成、语音合成
4. **voiceRecorder.js** - 音频录制、VAD、音频处理
5. **speechRecognition.js** - 唤醒词检测、Whisper API调用
6. **replicateService.js** - Replicate API集成（用于未来模型）
7. **tools.js** - 函数调用工具定义（搜索、天气、新闻）
8. **localMotionAI.js** - 动画选择的本地动作AI
9. **voicePrintService.js** - 语音指纹分析
10. **umaVoiceService.js** - 赛马娘语音（遗留）

## 许可证

Copyright 2025 miu-chang (miu sekiguchi). All rights reserved.

### 使用条款
- 允许个人和商业使用
- 禁止重新分发应用程序本身
- 禁止逆向工程、反编译和反汇编
- 严禁用于非法活动

### 隐私政策
- 对话数据仅存储在本地
- 用户输入被发送到OpenAI API以生成响应
- 语音数据在本地处理以进行语音识别
- 许可证密钥信息存储用于身份验证目的
- 未经同意不收集或共享个人数据

### 开源许可证

本应用程序使用以下开源软件：

- **Electron** - MIT License
- **React** - MIT License
- **Three.js** - MIT License
- **@pixiv/three-vrm** - MIT License
- **mmd-parser** - MIT License
- **ammojs-typed** - MIT License
- **@ricky0123/vad-web** - ISC License (Voice Activity Detection)
- **vosk-browser** - Apache 2.0 License

完整的许可证文本可在应用程序的"设置" →"关于" →"许可证"中找到。

## 制作人员

### 3D模型

**Alicia Solid（Niconico立绘酱）**
- 版权：Dwango股份有限公司
- 许可证：允许个人/商业使用（不包括法人）、允许修改
- 署名：不需要
- 官方：https://3d.nicovideo.jp/alicia/

### 文本转语音

**VOICEVOX**
- 引擎：Hiroshiba Kazuyuki
- 许可证：允许商业和非商业使用
- 需要署名："VOICEVOX: [角色名称]"
- 角色：100+语音，包括：
  - ずんだもん（Zundamon）
  - 四国めたん（Shikoku Metan）
  - 春日部つむぎ（Kasukabe Tsumugi）
  - 猫使ビィ（Neko Tsuka Bii）
  - 東北きりたん（Tohoku Kiritan）
  - 以及更多
- 官方：https://voicevox.hiroshiba.jp/

### 动画

**Mixamo动画**
- 来源：Adobe Mixamo
- 转换为VRMA格式
- 包含64个动画

**MMD动作**
- 音街宇奈官方动作 © MTK INTERNET Co., Ltd. - 商业使用请参考指南
  - 官方网站: https://otomachiuna.jp/
- Mutsugoro - 待机循环、对话动作等
  - Niconico 3D: https://3d.nicovideo.jp/users/2603791
- 各种MMD动作创作者的作品
- 包含17个VMD文件
- 每个动作遵循各自的使用条款
- 详情: https://3d.nicovideo.jp/

### 开发

**开发者**：miu-chang (miu sekiguchi)
- Email: weiyu.illustration2002@gmail.com
- Discord: https://discord.gg/fsZaFkDDrU
- GitHub: https://github.com/miu-chang/Kawaii_Agent

## 联系与支持

### 支持渠道

- **Email**: weiyu.illustration2002@gmail.com
- **Discord Server**: https://discord.gg/fsZaFkDDrU
- **GitHub Issues**: https://github.com/miu-chang/Kawaii_Agent/issues

### 常见问题

**Q：我需要OpenAI API密钥吗？**
A：BOOTH版本不需要。只有开源版本需要您自己的API密钥。

**Q：可以离线使用吗？**
A：不可以，AI功能（对话、语音识别）需要互联网连接。

**Q：我可以使用自己的VRM模型吗？**
A：可以，将VRM文件拖放到窗口中即可。

**Q：允许商业使用VOICEVOX语音吗？**
A：可以，根据每个角色的条款进行适当的署名即可。

**Q：在macOS上运行吗？**
A：可以，支持macOS 10.15及更高版本。

**Q：需要GPU吗？**
A：需要支持WebGL 2.0的GPU。集成GPU可以运行，但推荐使用专用GPU。

**Q：AI响应速度有多快？**
A：通常为1-3秒，取决于网络和API负载。

**Q：一个许可证可以在多少台PC上使用？**
A：许可证是按用户计算的。有关多设备使用，请联系支持。

**Q：我可以自定义角色个性吗？**
A：可以，在设置中编辑系统提示以定义任何个性。

**Q：AI支持哪些语言？**
A：主要是日语，但GPT-4.1 mini支持多种语言。TTS仅支持日语（VOICEVOX）。

### 已知问题

- 大型MMD模型（100MB+）可能需要时间加载
- 某些MMD模型可能具有不稳定的物理
- macOS可能会在首次启动时显示安全警告（在设置中允许）
- VAD在嘈杂的环境中可能会误报

### 路线图

正在考虑的未来功能：
- 多语言UI
- 更多TTS引擎选项
- 本地LLM支持
- VTuber模式（虚拟摄像头输出）
- 移动伴侣应用
- 自定义动画编辑器

## 更新日志

### 版本1.0.0（2025年10月）
- 初始版本
- GPT-4.1 mini集成
- VRM和MMD模型支持
- VOICEVOX TTS集成
- 包含64个VRMA动画
- 包含17个MMD VMD动作
- 使用Ammo.js的物理模拟
- 唤醒词检测
- 函数调用（网络搜索、天气、新闻）
- 许可证系统实现
- 自动对话功能
- 点击交互
- 抚摸模式
- IndexedDB存储
- 可自定义提示

---

For detailed BOOTH sales information, see [BOOTH_DESCRIPTION.md](BOOTH_DESCRIPTION.md).

For technical implementation details and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon).
