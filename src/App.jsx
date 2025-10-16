import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import VRMViewer from './components/VRMViewer';
import aiService from './services/aiService';
import replicateService from './services/replicateService';
import { MOTION_LIBRARY } from './services/localMotionAI';
import { unzip } from 'fflate';
// import moeTTSService from './services/moeTTSService'; // Hidden feature: enabled via localStorage
import voicevoxService from './services/voicevoxService'; // VOICEVOX追加
import voiceRecorder from './services/voiceRecorder';
import speechRecognition from './services/speechRecognition';
import voicePrintService from './services/voicePrintService';
import { toolDefinitions, toolExecutor } from './services/tools';
import { saveImportedMotions, loadImportedMotions, saveFavoriteMotions, loadFavoriteMotions, saveImportedModels, loadImportedModels, saveFavoriteModels, loadFavoriteModels } from './utils/indexedDB';
import LicenseModal from './components/LicenseModal';
import AboutModal from './components/AboutModal';
import ConsentModal from './components/ConsentModal';
import VRoidModelPicker from './components/VRoidModelPicker';
import licenseApi from './services/licenseApi';
import ttsModManager from './services/ttsModManager';
import googleApiService from './services/googleApiService';


// 全ての待機モーション（ループ可能なもの）
const ALL_IDLE_MOTIONS = [
  'idle_sway_alt',
  'idle_lively',
  'idle_cheerful',
  'idle_sleepy',
  'idle_look_right',
  'idle_walk_loop',
  'walk',
  'walking_turn',
  'happy_walk',
  'happy_walk_alt',
  'typing'
];

const PRIMARY_IDLE_MOTION = 'dwarf_idle'; // VRM用
const PRIMARY_MMD_MOTION = 'ぼんやり待ちループ'; // MMD用の静かな待機モーション

const IMAGE_MIME_MAP = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  tga: 'image/x-tga',
  gif: 'image/gif',
  webp: 'image/webp',
  spa: 'image/png',
  sph: 'image/png',
  dds: 'image/vnd.ms-dds'
};

const guessMimeType = (ext = '') => {
  const lower = ext.toLowerCase();
  if (IMAGE_MIME_MAP[lower]) {
    return IMAGE_MIME_MAP[lower];
  }
  if (lower === 'pmx' || lower === 'pmd' || lower === 'vmd') {
    return 'application/octet-stream';
  }
  if (lower === 'wav' || lower === 'mp3') {
    return `audio/${lower}`;
  }
  return 'application/octet-stream';
};

const normalizeKey = (path = '') => path.replace(/\\/g, '/').toLowerCase();

const sanitizeMotionKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

// モーション名から表情を推測する関数
const guessEmotionFromMotion = (motionName = '') => {
  const lower = motionName.toLowerCase();

  // happy系（積極的・楽しい動作）
  if (lower.includes('happy') || lower.includes('joy') || lower.includes('excited') ||
      lower.includes('smile') || lower.includes('laugh') || lower.includes('cheer') ||
      lower.includes('clap') || lower.includes('wave') || lower.includes('waving') ||
      lower.includes('greeting') || lower.includes('sing')) {
    return 'happy';
  }

  // sad系
  if (lower.includes('sad') || lower.includes('cry') || lower.includes('tear') ||
      lower.includes('depress')) {
    return 'sad';
  }

  // thinking系（考え中・集中）
  if (lower.includes('think') || lower.includes('confus') || lower.includes('wonder') ||
      lower.includes('typing') || lower.includes('looking_files') || lower.includes('looking_through')) {
    return 'thinking';
  }

  // surprised系
  if (lower.includes('surprise') || lower.includes('shock') || lower.includes('amaze') ||
      lower.includes('jump')) {
    return 'surprised';
  }

  // angry系
  if (lower.includes('angry') || lower.includes('mad') || lower.includes('rage')) {
    return 'angry';
  }

  // sleep系 → 目を閉じて口を少し笑顔
  if (lower.includes('sleep') || lower.includes('sleeping') || lower.includes('laying')) {
    return 'sleeping';
  }

  // relaxed系（酔っぱらい、リラックス）
  if (lower.includes('relax') || lower.includes('calm') || lower.includes('lazy') ||
      lower.includes('tired') || lower.includes('drunk')) {
    return 'thinking';  // VRMの'relaxed'表情を使うため'thinking'を返す
  }

  // デフォルトはneutral（idle, walk, turn, look_around など）
  return 'neutral';
};

// AI応答テキストから感情キーワードを検出する関数
const detectEmotionFromText = (text = '') => {
  if (!text) return null;

  const lower = text.toLowerCase();

  // 恥ずかしい系
  if (lower.includes('恥ずかし') || lower.includes('照れ') || lower.includes('はずかし') ||
      lower.includes('てれ') || lower.includes('///')) {
    return 'happy'; // 照れ笑顔
  }

  // 怒り系
  if (lower.includes('やめて') || lower.includes('ダメ') || lower.includes('だめ') ||
      lower.includes('怒') || lower.includes('もう') || lower.includes('！！')) {
    return 'angry';
  }

  // 驚き系
  if (lower.includes('え') || lower.includes('びっくり') || lower.includes('驚') ||
      lower.includes('！？') || lower.includes('えっ') || lower.includes('わっ')) {
    return 'surprised';
  }

  // 喜び系
  if (lower.includes('嬉し') || lower.includes('ありがと') || lower.includes('やった') ||
      lower.includes('わぁ') || lower.includes('♪') || lower.includes('♡')) {
    return 'happy';
  }

  // 不思議・困惑系
  if (lower.includes('なんで') || lower.includes('どうして') || lower.includes('？') ||
      lower.includes('不思議') || lower.includes('変')) {
    return 'thinking';
  }

  // 検出失敗
  return null;
};

const SHIFT_JIS_DECODER = (() => {
  try {
    return new TextDecoder('shift-jis');
  } catch (error) {
    console.warn('Shift-JIS TextDecoder not available:', error);
    return null;
  }
})();

const MMD_PRIMARY_KEYWORDS = ['ループ', 'ご機嫌', 'ぼんやり'];

// ポーズファイル（静止ポーズ）を除外するキーワード
// 注意：可愛いモーションを優先するため、除外キーワードは最小限に
const MMD_POSE_KEYWORDS = [];

// インタラクション用モーションキーワード
const MMD_TAP_KEYWORDS = ['頭かく', 'dadakko', 'chikayori', 'azatokawaii'];  // タップ時（照れる、甘える）
const MMD_PET_KEYWORDS = ['ご機嫌', 'skip'];  // 撫でる時（嬉しい、スキップ）

// 音街ウナモーション自動認識データベース（削除した14個すべて網羅）
const OTOMACHI_UNA_MOTIONS = {
  // Primary（キーワード：ループ、ご機嫌、ぼんやり）
  'ご機嫌ループ': { category: 'primary', type: 'idle' },
  'ぼんやり待ちループ': { category: 'primary', type: 'idle' },

  // Tap（キーワード：頭かく、dadakko、chikayori、azatokawaii）
  '会話モーション_頭かく': { category: 'tap', type: 'gesture' },
  'AzatokawaiiTurn': { category: 'tap', type: 'reaction' },
  'ChikayoriPose': { category: 'tap', type: 'reaction' },
  'DadakkoMotion': { category: 'tap', type: 'reaction' },

  // Pet（キーワード：ご機嫌、skip）
  'Skip': { category: 'pet', type: 'happy' },

  // Variants（上記のキーワードに該当しないもの）
  'Audience': { category: 'variants', type: 'pose' },
  'FeminineWalk': { category: 'variants', type: 'walk' },
  'Kabedon': { category: 'variants', type: 'reaction' },
  'Running': { category: 'variants', type: 'run' },
  'Turn&Shootagun': { category: 'variants', type: 'reaction' },
  'Turn_Pose': { category: 'variants', type: 'pose' },
  'Walk+cutely+and+wave': { category: 'variants', type: 'walk' },
  'agura_motion': { category: 'variants', type: 'sit' },
  'zenten_motion': { category: 'variants', type: 'reaction' },
  'モデルポージング': { category: 'variants', type: 'pose' }
};

const classifyMmdAnimations = (animations = []) => {
  if (!Array.isArray(animations) || animations.length === 0) {
    return { primary: [], variants: [], tapMotions: [], petMotions: [] };
  }

  // ポーズファイルを除外（静止ポーズはアニメーションとして使えない）
  const poseKeywords = MMD_POSE_KEYWORDS.map(kw => kw.toLowerCase());
  const animationFiles = animations.filter(anim => {
    const reference = (anim.normalized || anim.name || '').toLowerCase();
    const isPose = poseKeywords.some(kw => reference.includes(kw));
    return !isPose;
  });

  console.log('[App] Filtered animations (excluding poses):', animationFiles.length, 'out of', animations.length);

  if (animationFiles.length === 0) {
    console.warn('[App] No animation files found after filtering poses');
    return { primary: [], variants: [], tapMotions: [], petMotions: [] };
  }

  const primaryKeywords = MMD_PRIMARY_KEYWORDS.map((kw) => kw.toLowerCase());
  const primarySanitized = primaryKeywords.map((kw) => sanitizeMotionKey(kw));
  const tapKeywords = MMD_TAP_KEYWORDS.map((kw) => kw.toLowerCase());
  const petKeywords = MMD_PET_KEYWORDS.map((kw) => kw.toLowerCase());

  const primaryAnims = [];
  const tapAnims = [];
  const petAnims = [];

  animationFiles.forEach((anim) => {
    // categoryプロパティがある場合は優先的に使用（インポートモーション用）
    if (anim.category) {
      if (anim.category === 'primary') {
        primaryAnims.push(anim);
        return;
      } else if (anim.category === 'tap') {
        tapAnims.push(anim);
        return;
      } else if (anim.category === 'pet') {
        petAnims.push(anim);
        return;
      }
      // category === 'variants' の場合はキーワード判定をスキップ（後でvariantsに分類される）
      return;
    }

    // categoryがない場合は従来のキーワードマッチング
    const reference = (anim.normalized || anim.name || '').toLowerCase();
    const sanitized = anim.sanitized || sanitizeMotionKey(anim.normalized || anim.name || '');

    // Primary判定
    const matchesPrimaryRaw = primaryKeywords.some((kw) => kw && reference.includes(kw));
    const matchesPrimarySanitized = primarySanitized.some((kw) => kw && sanitized.includes(kw));
    if (matchesPrimaryRaw || matchesPrimarySanitized) {
      primaryAnims.push(anim);
    }

    // Tap判定
    const matchesTap = tapKeywords.some((kw) => kw && reference.includes(kw));
    if (matchesTap) {
      tapAnims.push(anim);
    }

    // Pet判定
    const matchesPet = petKeywords.some((kw) => kw && reference.includes(kw));
    if (matchesPet) {
      petAnims.push(anim);
    }
  });

  if (primaryAnims.length === 0) {
    primaryAnims.push(animationFiles[0]);
  }

  const variants = animationFiles.filter((anim) =>
    !primaryAnims.includes(anim) &&
    !tapAnims.includes(anim) &&
    !petAnims.includes(anim)
  );

  return { primary: primaryAnims, variants, tapMotions: tapAnims, petMotions: petAnims };
};

const MMD_MOTION_HINTS = {
  idle_sway_alt: ['loop', '待', 'ぼんやり', 'wait'],
  idle_cheerful: ['ご機嫌', 'gokigen', 'audience', 'skip', 'cute', 'azato'],
  idle_lively: ['skip', 'chikayori', 'azato', 'turn', '会話', 'audience'],
  idle_sleepy: ['agura', 'ぼんやり', 'dadakko'],
  idle_look_right: ['pose', 'turn', 'chikayori'],
  wave: ['wave', 'walk+cutely', 'walk+cute', 'audience', '手', 'cutely'],
  wave_big: ['wave', 'audience', 'turn', 'skip'],
  clap: ['audience', 'clap', '拍手', 'skip'],
  thinking: ['会話', '頭', 'pose', 'kabedon', 'chikayori'],
  looking_files: ['pose', '会話', 'turn'],
  joy: ['skip', 'audience', 'ご機嫌', 'azato'],
  joyful_jump: ['skip', 'audience', 'turn', 'ご機嫌'],
  excited: ['audience', 'feminine', 'skip', 'azato', 'ご機嫌'],
  sad: ['dadakko', 'agura', 'ぼんやり'],
  surprised: ['turn&shoot', 'shoot', 'kabedon', '壁', 'turn'],
  typing: ['pose', '会話'],
  walk: ['walk', 'running', 'feminine'],
  walking_turn: ['turn', 'azato', 'walk', 'shoot'],
  happy_walk: ['feminine', 'walk', 'running', 'skip', 'cutely'],
  happy_walk_alt: ['walk', 'wave', 'skip', 'cutely'],
  standing_greeting: ['chikayori', 'pose', 'turn', 'azato']
};

const createResourceContainer = () => ({ map: new Map(), urls: new Set(), animations: [] });

const decodeZipPath = (raw = '') => {
  if (!raw) {
    return raw;
  }

  const slashNormalized = raw.replace(/\\/g, '/');

  // ASCII文字のみの場合はそのまま返す
  const asciiOnly = /^[\x00-\x7F]+$/.test(slashNormalized);
  if (asciiOnly) {
    return slashNormalized;
  }

  // 日本語Unicode文字（ひらがな、カタカナ、漢字）を含む場合は既に正しくデコードされている
  // Hiragana: U+3040-309F, Katakana: U+30A0-30FF, CJK: U+4E00-9FFF
  const hasJapaneseUnicode = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(slashNormalized);
  if (hasJapaneseUnicode) {
    // 既に正しいUnicodeなのでそのまま返す
    return slashNormalized;
  }

  // ここまで来たら、Latin-1文字でShift-JISとしてデコードが必要な可能性がある
  // 全ての文字が0xFF以下（Latin-1範囲）かチェック
  let allLowBytes = true;
  for (let i = 0; i < slashNormalized.length; i++) {
    if (slashNormalized.charCodeAt(i) > 0xFF) {
      allLowBytes = false;
      break;
    }
  }

  // 高位バイトを含む場合はそのまま返す（既に正しくデコードされている可能性）
  if (!allLowBytes) {
    return slashNormalized;
  }

  // Shift-JISデコーダーがない場合はそのまま返す
  if (!SHIFT_JIS_DECODER) {
    return slashNormalized;
  }

  // Shift-JISデコードを試みる
  try {
    const bytes = new Uint8Array(slashNormalized.length);
    for (let i = 0; i < slashNormalized.length; i++) {
      bytes[i] = slashNormalized.charCodeAt(i) & 0xff;
    }
    const decoded = SHIFT_JIS_DECODER.decode(bytes);
    return decoded.replace(/\\/g, '/');
  } catch (error) {
    console.warn('Failed to decode as Shift-JIS:', slashNormalized);
    return slashNormalized;
  }
};

const detectMimeFromBytes = (bytes, fallbackExt = '') => {
  if (!bytes?.length) {
    return guessMimeType(fallbackExt);
  }

  const view = bytes.subarray(0, 12);
  if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) {
    return 'image/png';
  }
  if (view[0] === 0x42 && view[1] === 0x4d) {
    return 'image/bmp';
  }
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    return 'image/jpeg';
  }
  if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46) {
    return 'image/gif';
  }
  if (view[0] === 0x44 && view[1] === 0x44 && view[2] === 0x53 && view[3] === 0x20) {
    return 'image/vnd.ms-dds';
  }
  if (view[0] === 0x54 && view[1] === 0x47 && view[2] === 0x41) {
    return 'image/x-tga';
  }

  return guessMimeType(fallbackExt);
};

const addResourceToMap = (resource, path, url) => {
  if (!resource) return;
  const normalized = normalizeKey(path);
  if (normalized && !resource.map.has(normalized)) {
    resource.map.set(normalized, url);
  }
  const base = normalized.split('/').pop();
  if (base && !resource.map.has(base)) {
    resource.map.set(base, url);
  }
  const ext = base?.split('.').pop();
  if (ext && ext.toLowerCase() === 'vmd') {
    const motionName = (base || normalized).replace(/\.vmd$/, '');
    resource.animations.push({
      url,
      name: motionName,
      normalized,
      sanitized: sanitizeMotionKey(motionName)
    });
  }
};

function App() {
  const [modelUrl, setModelUrl] = useState(null);
  const [modelType, setModelType] = useState('auto');
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [importedMotions, setImportedMotions] = useState([]);
  const [favoriteMotions, setFavoriteMotions] = useState([]);
  const [importedModels, setImportedModels] = useState([]);
  const [favoriteModels, setFavoriteModels] = useState([]);
  const [motionControls, setMotionControls] = useState(null);
  const [enableMouseFollow, setEnableMouseFollow] = useState(true);
  const [enableCameraFollow, setEnableCameraFollow] = useState(true);
  const [enableManualCamera, setEnableManualCamera] = useState(true);
  const [overlayBlendRatio, setOverlayBlendRatio] = useState(() => {
    const saved = localStorage.getItem('overlayBlendRatio');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [mmdScale, setMmdScale] = useState(() => {
    const saved = localStorage.getItem('mmdScale');
    return saved !== null ? parseFloat(saved) : 0.09;
  });
  const [vrmScale, setVrmScale] = useState(() => {
    const saved = localStorage.getItem('vrmScale');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [enableInteractionVoice, setEnableInteractionVoice] = useState(() => {
    const saved = localStorage.getItem('enableInteractionVoice');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [enableInteraction, setEnableInteraction] = useState(() => {
    const saved = localStorage.getItem('enableInteraction');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [mmdShininess, setMmdShininess] = useState(() => {
    const saved = localStorage.getItem('mmdShininess');
    return saved !== null ? parseFloat(saved) : 50;
  });
  const [mmdBrightness, setMmdBrightness] = useState(() => {
    const saved = localStorage.getItem('mmdBrightness');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [aiStatus, setAiStatus] = useState('not-initialized'); // not-initialized, loading, ready, error
  const [aiProgress, setAiProgress] = useState('');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(licenseApi.getLicenseInfo());
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  // 起動時に利用規約同意チェック
  useEffect(() => {
    const termsAccepted = localStorage.getItem('termsAccepted');
    if (!termsAccepted) {
      setIsConsentModalOpen(true);
    }
  }, []);

  // 起動時にライセンスチェック（APIキーがない場合のみ、利用規約同意後）
  useEffect(() => {
    const termsAccepted = localStorage.getItem('termsAccepted');
    if (termsAccepted) {
      const savedApiKey = localStorage.getItem('openaiApiKey');
      if (!licenseApi.hasValidLicense() && !savedApiKey) {
        setIsLicenseModalOpen(true);
      }
    }
  }, []);


  const [isTyping, setIsTyping] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [currentGesture, setCurrentGesture] = useState(null);
  const lastInteractionTimeRef = useRef(Date.now());
  const lastAutoTalkTimeRef = useRef(0); // 自動話しかけ専用タイマー
  const [isAutoTalking, setIsAutoTalking] = useState(false); // 自動話しかけ中フラグ
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeechText, setCurrentSpeechText] = useState(''); // GPT-5 nano表情制御用の発話テキスト
  const [isPreparingVoice, setIsPreparingVoice] = useState(false);
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false); // TTS再生中フラグ
  const [voiceCharacter, setVoiceCharacter] = useState('猫使ビィ (おちつき)');
  const [ttsEngine, setTtsEngine] = useState('voicevox'); // 'voicevox'のみ（moeTTS/Umaはコメントアウト）
  const [ttsLanguage, setTtsLanguage] = useState('JA'); // model12用の言語設定
  const [characterList, setCharacterList] = useState([]);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState(''); // ボイス検索用
  const [voiceSpeedScale, setVoiceSpeedScale] = useState(1.0); // 話速（0.5〜2.0）
  const [voicePitchScale, setVoicePitchScale] = useState(0.0); // 音高（-0.15〜0.15）
  const [voiceIntonationScale, setVoiceIntonationScale] = useState(2.0); // 抑揚（0.0〜2.0）
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('あなたは14歳の可愛らしい女の子、アリシアです。\n\n性格：\n- 真面目で可愛らしい良い子です\n- 素直で優しく、親切に接します\n- でも、たまに調子に乗って得意げになることもあります\n- 一人称は「私」です\n- ユーザーとは親しい関係で、心を許しています\n\n話し方：\n- 敬語は使わず、親しみやすい口調で話します\n- ツンデレではなく、素直に感情を表現します\n- たまに自慢げに話すこともありますが、基本は良い子です\n\n返答のルール：\n- 短く簡潔に答えてください（1-2文程度）\n- 可愛らしく、素直で優しい話し方をしてください\n- 親しみを込めて、自然体で会話してください');

  // タップインタラクションプロンプト設定
  const [tapPrompts, setTapPrompts] = useState({
    skirt: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたのスカートに触れました。驚いたり、恥ずかしがって反応してください。',
    hair: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの髪に触れました。嬉しそうに反応してください。',
    accessory: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたのアクセサリーに触れました。不思議そうに反応してください。',
    intimate: 'あなたとユーザーはとても親密な関係です。ユーザーが予想外のところに触れました。恥ずかしがったり、少し怒ったり、驚いた反応を返してください。',
    head: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの頭に触れました。照れて嬉しそうに反応してください。',
    shoulder: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの肩に触れました。普通に反応してください。',
    arm: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの腕や手に触れました。嬉しそうに反応してください。',
    leg: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの足に触れました。不思議そうに反応してください。',
    default: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたに触れました。反応してください。',
    pet: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたを優しく撫でています。嬉しそうに反応してください。'
  });
  const [showTapPromptSettings, setShowTapPromptSettings] = useState(false);
  const [showKeyBindings, setShowKeyBindings] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false); // 左側コントロールパネルの表示状態

  // インタラクション履歴（最新5件程度を保持）
  const [interactionHistory, setInteractionHistory] = useState([]);

  const [enableAutoTalk, setEnableAutoTalk] = useState(() => {
    const saved = localStorage.getItem('enableAutoTalk');
    return saved ? JSON.parse(saved) : false;
  });
  const [autoTalkPrompt, setAutoTalkPrompt] = useState(() => {
    const saved = localStorage.getItem('autoTalkPrompt');
    return saved || 'ユーザーが2分間放置しています。「おーい」「寝てる？」「起きてる？」「どうしたの？」などの短い呼びかけ（10文字以内）を返してください。';
  });
  const [showAboveFullscreen, setShowAboveFullscreen] = useState(() => {
    const saved = localStorage.getItem('showAboveFullscreen');
    return saved ? JSON.parse(saved) : false;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false); // 声質調整モーダル
  const [showAboutModal, setShowAboutModal] = useState(false); // Aboutモーダル
  const [showModelSourceModal, setShowModelSourceModal] = useState(false); // モデル読み込み元選択モーダル
  const [showVRoidPicker, setShowVRoidPicker] = useState(false); // VRoid Hubモデル選択
  const [googleAuthStatus, setGoogleAuthStatus] = useState('disconnected'); // Google連携状態
  const [installedMods, setInstalledMods] = useState([]); // インストール済みMod一覧
  const [showModManagement, setShowModManagement] = useState(false); // Mod管理セクション開閉
  const [hideVoicevoxNotice, setHideVoicevoxNotice] = useState(() => {
    const saved = localStorage.getItem('hideVoicevoxNotice');
    return saved ? JSON.parse(saved) : false;
  });

  // 物理演算制御（OOM対策）
  const [enablePhysics, setEnablePhysics] = useState(() => {
    const saved = localStorage.getItem('enablePhysics');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [enablePmxAnimation, setEnablePmxAnimation] = useState(() => {
    const saved = localStorage.getItem('enablePmxAnimation');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [enableSimplePhysics, setEnableSimplePhysics] = useState(() => {
    const saved = localStorage.getItem('enableSimplePhysics');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const enablePhysicsRef = useRef(enablePhysics);
  const oomDetectedRef = useRef(false);
  const oomRetryCountRef = useRef(0);  // OOM再試行回数
  const [webglResetKey, setWebglResetKey] = useState(0);  // WebGLコンテキストリセット用

  // enablePhysicsの変更をRefに同期
  useEffect(() => {
    enablePhysicsRef.current = enablePhysics;
  }, [enablePhysics]);

  // ウェイクワード関連
  const [wakeWords, setWakeWords] = useState(() => {
    const saved = localStorage.getItem('wakeWords');
    return saved ? JSON.parse(saved) : ['ねえアリシア', 'アリシア', 'ヘイアリシア'];
  });
  const [endWords, setEndWords] = useState(() => {
    const saved = localStorage.getItem('endWords');
    return saved ? JSON.parse(saved) : ['おっけー', 'ありがとう', '終わり', 'バイバイ'];
  });

  // 設定変更を即時反映するためのRef
  const wakeWordsRef = useRef(wakeWords);
  const endWordsRef = useRef(endWords);
  const isConversationModeRef = useRef(isConversationMode);
  const aiStatusRef = useRef(aiStatus);

  useEffect(() => {
    wakeWordsRef.current = wakeWords;
  }, [wakeWords]);

  useEffect(() => {
    endWordsRef.current = endWords;
  }, [endWords]);

  // IndexedDBからインポートモーション・モデルとお気に入りを読み込み
  useEffect(() => {
    async function loadData() {
      try {
        console.log('[IndexedDB] Loading data from IndexedDB...');
        const [importedMotionsData, favoriteMotionsData, importedModelsData, favoriteModelsData] = await Promise.all([
          loadImportedMotions(),
          loadFavoriteMotions(),
          loadImportedModels(),
          loadFavoriteModels()
        ]);
        console.log('[IndexedDB] Raw data loaded:', {
          motions: importedMotionsData,
          models: importedModelsData
        });
        setImportedMotions(Array.isArray(importedMotionsData) ? importedMotionsData : []);
        setFavoriteMotions(Array.isArray(favoriteMotionsData) ? favoriteMotionsData : []);
        setImportedModels(Array.isArray(importedModelsData) ? importedModelsData : []);
        setFavoriteModels(Array.isArray(favoriteModelsData) ? favoriteModelsData : []);
        console.log('[IndexedDB] Loaded', importedMotionsData?.length || 0, 'motions,', importedModelsData?.length || 0, 'models');
      } catch (error) {
        console.error('[IndexedDB] Failed to load data:', error);
        setImportedMotions([]);
        setFavoriteMotions([]);
        setImportedModels([]);
        setFavoriteModels([]);
      }
    }
    loadData();
  }, []);

  // TTS Modsを読み込み
  useEffect(() => {
    async function loadMods() {
      try {
        const mods = await ttsModManager.listMods();
        setInstalledMods(mods);
        console.log('[TTS Mods] Loaded', mods.length, 'mods');
      } catch (error) {
        console.error('[TTS Mods] Failed to load mods:', error);
        setInstalledMods([]);
      }
    }
    loadMods();
  }, []);

  useEffect(() => {
    isConversationModeRef.current = isConversationMode;
  }, [isConversationMode]);

  useEffect(() => {
    aiStatusRef.current = aiStatus;
  }, [aiStatus]);

  // importedMotionsの変更をIndexedDBに保存
  useEffect(() => {
    console.log('[IndexedDB] importedMotions changed, length:', importedMotions?.length, 'isArray:', Array.isArray(importedMotions));
    if (Array.isArray(importedMotions) && importedMotions.length > 0) {
      console.log('[IndexedDB] Saving imported motions:', importedMotions.length);
      saveImportedMotions(importedMotions).then(() => {
        console.log('[IndexedDB] Imported motions saved successfully');
      }).catch(error => {
        console.error('[IndexedDB] Failed to save imported motions:', error);
      });
    } else {
      console.log('[IndexedDB] Skipping save (empty or not array)');
    }
  }, [importedMotions]);

  // favoriteMotionsの変更をIndexedDBに保存
  useEffect(() => {
    if (Array.isArray(favoriteMotions) && favoriteMotions.length > 0) {
      saveFavoriteMotions(favoriteMotions).catch(error => {
        console.error('[IndexedDB] Failed to save favorite motions:', error);
      });
    }
  }, [favoriteMotions]);

  // importedModelsの変更をIndexedDBに保存
  useEffect(() => {
    if (Array.isArray(importedModels) && importedModels.length > 0) {
      console.log('[IndexedDB] Saving imported models:', importedModels.length);
      saveImportedModels(importedModels).then(() => {
        console.log('[IndexedDB] Imported models saved successfully');
      }).catch(error => {
        console.error('[IndexedDB] Failed to save imported models:', error);
      });
    }
  }, [importedModels]);

  // favoriteModelsの変更をIndexedDBに保存
  useEffect(() => {
    if (Array.isArray(favoriteModels) && favoriteModels.length > 0) {
      saveFavoriteModels(favoriteModels).catch(error => {
        console.error('[IndexedDB] Failed to save favorite models:', error);
      });
    }
  }, [favoriteModels]);

  // OOM検知とリセット
  useEffect(() => {
    // OOMコールバックを設定（VRMViewerから呼ばれる）
    window.oomCallback = () => {
      if (!oomDetectedRef.current) {
        oomDetectedRef.current = true;
        oomRetryCountRef.current += 1;

        console.error(`[OOM Detected] Retry count: ${oomRetryCountRef.current}`);

        // 1回目：WebGLコンテキストリセット（擬似リロード）
        if (oomRetryCountRef.current === 1) {
          console.error('[OOM Detected] Attempt 1: Resetting WebGL context (pseudo-reload)');

          // 物理ワールドの明示的な破棄を試みる
          if (window.forceCleanupPhysics) {
            console.log('[OOM Detected] Forcing physics cleanup before WebGL reset');
            window.forceCleanupPhysics();
          }

          // WebGLリセット：keyを変更してVRMViewerを強制再マウント
          // これでCanvas、WebGLコンテキスト、Ammo.js WASMヒープが全て破棄→再作成される
          console.log('[OOM Detected] Unmounting VRMViewer (destroying WebGL context)');
          setWebglResetKey(prev => prev + 1);

          // 状態はそのまま保持されるので、ユーザー体験は維持される
          setTimeout(() => {
            console.log('[OOM Detected] WebGL context reset complete');
            oomDetectedRef.current = false;
          }, 1000);
        }
        // 2回目以降：物理をオフにしてWebGLリセット
        else {
          console.error('[OOM Detected] Attempt 2+: Disabling physics and resetting WebGL');

          // 物理をオフにする
          enablePhysicsRef.current = false;
          setEnablePhysics(false);
          localStorage.setItem('enablePhysics', JSON.stringify(false));

          // 物理ワールドの明示的な破棄を試みる
          if (window.forceCleanupPhysics) {
            console.log('[OOM Detected] Forcing physics cleanup before WebGL reset');
            window.forceCleanupPhysics();
          }

          // WebGLリセット
          console.log('[OOM Detected] Unmounting VRMViewer with physics disabled');
          setWebglResetKey(prev => prev + 1);

          setTimeout(() => {
            console.log('[OOM Detected] WebGL context reset complete (physics disabled)');
            oomDetectedRef.current = false;
            // 再試行カウンターはリセットしない（物理オフのまま維持）
          }, 1000);
        }
      }
    };

    const handleError = (event) => {
      const errorMsg = event.error?.message || event.message || '';
      const isOOM = errorMsg.includes('OOM') ||
                    errorMsg.includes('out of memory') ||
                    errorMsg.includes('abort(OOM)');

      if (isOOM && !oomDetectedRef.current) {
        oomDetectedRef.current = true;
        console.error('[OOM Detected] Attempting to recover by reloading model');

        // window.oomCallbackを呼んでモデルリロード（物理はオンのまま）
        if (window.oomCallback) {
          window.oomCallback();
        }

        setTimeout(() => {
          oomDetectedRef.current = false;
        }, 3000);

        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event) => {
      const errorMsg = event.reason?.message || event.reason || '';
      const isOOM = typeof errorMsg === 'string' &&
                    (errorMsg.includes('OOM') ||
                     errorMsg.includes('out of memory') ||
                     errorMsg.includes('abort(OOM)'));

      if (isOOM && !oomDetectedRef.current) {
        oomDetectedRef.current = true;
        console.error('[OOM Detected] Attempting to recover by reloading model');

        // window.oomCallbackを呼んでモデルリロード（物理はオンのまま）
        if (window.oomCallback) {
          window.oomCallback();
        }

        setTimeout(() => {
          oomDetectedRef.current = false;
        }, 3000);

        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [modelType]);

  const [wakeWordResponses, setWakeWordResponses] = useState(() => {
    const saved = localStorage.getItem('wakeWordResponses');
    return saved ? JSON.parse(saved) : ['はーい', 'どうしたの？', 'なになに？', '呼んだ？', 'なあに？'];
  });
  const [fillerPhrases, setFillerPhrases] = useState(() => {
    const saved = localStorage.getItem('fillerPhrases');
    return saved ? JSON.parse(saved) : ['なるほど', 'えーっとね', 'んーと', 'そうだね', 'ふむふむ'];
  });
  const [isConversationMode, setIsConversationMode] = useState(false); // 連続会話モード
  const [conversationTimer, setConversationTimer] = useState(null); // 20分タイマー
  const [showConversationConfirm, setShowConversationConfirm] = useState(false); // 継続確認ダイアログ
  const [showVoiceRegistration, setShowVoiceRegistration] = useState(false); // 音声登録モーダル
  const [voiceRegistrationStep, setVoiceRegistrationStep] = useState(0); // 登録ステップ (0-3)
  const [isVoiceRecordingForPrint, setIsVoiceRecordingForPrint] = useState(false); // 声紋登録中
  const [voicePrintCount, setVoicePrintCount] = useState(voicePrintService.getRegisteredCount());
  const [showMotionSelector, setShowMotionSelector] = useState(false);
  // const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedMotionData, setSelectedMotionData] = useState(null);
  const [manualLoopCount, setManualLoopCount] = useState(1);
  const [isInfiniteLoop, setIsInfiniteLoop] = useState(false);
  const [isManualPlaying, setIsManualPlaying] = useState(false);
  const [isEditingImportedMotions, setIsEditingImportedMotions] = useState(false);
  const [showMotionImportGuide, setShowMotionImportGuide] = useState(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenMotionImportGuide');
    return !hasSeenGuide; // 初回はtrueを返す
  });
  const [isRecording, setIsRecording] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null); // 現在選択中のモデル
  const conversationModeRef = useRef(false);
  const inputRef = useRef(null);
  const vrmaManagerRef = useRef(null);
  const motionPreloadRef = useRef(new Set());
  const vrmViewerRef = useRef(null);
  const clonedMeshRef = useRef(null); // MMD/VRMモデルのクローン保存用
  const [cameraConfig, setCameraConfig] = useState({ position: [0, 1.4, 2.5], fov: 50, lookAt: [0, 1, 0] });
  const [isResidentMode, setIsResidentMode] = useState(false);
  const [isResidentTouchMode, setIsResidentTouchMode] = useState(false); // 常駐モード時のお触りモード
  const [showResidentChat, setShowResidentChat] = useState(false);
  const residentChatEndRef = useRef(null);
  const residentChatContainerRef = useRef(null); // チャットコンテナのref
  const [capturedImage, setCapturedImage] = useState(null); // 画面キャプチャ画像
  const [isCapturing, setIsCapturing] = useState(false); // キャプチャ中フラグ
  const [timerReminderInterval, setTimerReminderInterval] = useState(null); // タイマー通知の繰り返しインターバル
  const defaultVRMCameraConfig = { position: [0, 1.4, 2.5], fov: 50, lookAt: [0, 1, 0] };
  const defaultMMDCameraConfig = { position: [0, 1.4, 2.5], fov: 50, lookAt: [0, 1.0, 0] };

  // モーション別カメラ設定
  const getMotionCameraConfig = useCallback((motionName) => {
    const motionCameraSettings = {
      'laying_sleeping': { position: [0, 0.6, 2.5], fov: 50, lookAt: [0, 0.4, 0] },
      'getting_up': { position: [0, 0.8, 2.5], fov: 50, lookAt: [0, 0.6, 0] },
      'swimming': { position: [0, 0.5, 3.0], fov: 50, lookAt: [0, 0.3, 0] }
    };

    return motionCameraSettings[motionName] || defaultVRMCameraConfig;
  }, []);

  // モデルタイプに応じてカメラ設定を更新
  useEffect(() => {
    if (modelType === 'mmd') {
      setCameraConfig(defaultMMDCameraConfig);
    } else if (modelType === 'vrm') {
      setCameraConfig(defaultVRMCameraConfig);
    }
  }, [modelType]);

  // 常駐モード切り替え時の処理
  const toggleResidentMode = useCallback(() => {
    setIsResidentMode(prev => !prev);
  }, []);

  // 常駐モード時のクリックスルー制御とウィンドウレベル制御
  useEffect(() => {
    if (window.electronAPI?.toggleClickThrough) {
      // 常駐モードでも、お触りモードの時は透過しない
      window.electronAPI.toggleClickThrough(isResidentMode && !isResidentTouchMode);
    }

    // ウィンドウレベル設定
    if (window.electronAPI?.setWindowLevel) {
      if (isResidentMode) {
        // 常駐モード：最前面表示ON
        const shouldBeAbove = showAboveFullscreen;
        window.electronAPI.setWindowLevel({ aboveFullscreen: shouldBeAbove, alwaysOnTop: true });
        console.log('[App] Window level above fullscreen:', shouldBeAbove);
      } else {
        // 通常モード：最前面表示OFF
        window.electronAPI.setWindowLevel({ alwaysOnTop: false });
        console.log('[App] Window level: normal (not always on top)');
      }
    }

    console.log('[App] Resident mode:', isResidentMode, 'Touch mode:', isResidentTouchMode);
  }, [isResidentMode, isResidentTouchMode, showAboveFullscreen]);

  // Google OAuth コールバック処理
  useEffect(() => {
    if (window.electronAPI?.onGoogleOAuthCode) {
      window.electronAPI.onGoogleOAuthCode(async (code) => {
        console.log('[Google Auth] OAuth code received');
        try {
          await googleApiService.exchangeCodeForToken(code);
          setGoogleAuthStatus('connected');
          console.log('[Google Auth] Successfully authenticated');
        } catch (err) {
          console.error('[Google Auth] Token exchange failed:', err);
          setGoogleAuthStatus('error');
          alert('Google認証に失敗しました: ' + err.message);
        }
      });

      window.electronAPI.onGoogleOAuthError((error) => {
        console.error('[Google Auth] OAuth error:', error);
        setGoogleAuthStatus('error');
        alert('Google認証エラー: ' + error);
      });
    }

    // 初期化時に認証状態を確認
    if (googleApiService.isAuthenticated()) {
      setGoogleAuthStatus('connected');
    }
  }, []);

  // 常駐モードチャットの自動スクロール
  useEffect(() => {
    if (showResidentChat && residentChatContainerRef.current) {
      // scrollIntoViewではなくscrollTopを使うことで、ウィンドウが動かないようにする
      residentChatContainerRef.current.scrollTop = residentChatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, showResidentChat]);

  // キーボードショートカット設定
  const [keyBindings, setKeyBindings] = useState(() => {
    const saved = localStorage.getItem('keyBindings');
    return saved ? JSON.parse(saved) : {
      settings: '1',
      controlPanel: '2',
      residentMode: '3',
      interaction: 'q',
      cameraFollow: 'w'
    };
  });

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 入力フィールドにフォーカスがある場合は無視
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === keyBindings.settings) {
        // 設定パネル切り替え（通常モードのみ）
        if (!isResidentMode) {
          setShowSettings(prev => !prev);
          console.log('[Keyboard] Settings panel toggled');
        }
      } else if (key === keyBindings.controlPanel) {
        // コントロールパネル切り替え（通常モードのみ）
        if (!isResidentMode) {
          setShowControlPanel(prev => !prev);
          console.log('[Keyboard] Control panel toggled');
        }
      } else if (key === keyBindings.residentMode) {
        // 常駐モード切り替え
        setIsResidentMode(prev => !prev);
        console.log('[Keyboard] Resident mode toggled');
      } else if (key === keyBindings.interaction) {
        // お触りモード切り替え
        if (isResidentMode) {
          // 常駐モード：isResidentTouchModeを切り替え
          setIsResidentTouchMode(prev => {
            const newValue = !prev;
            console.log('[Keyboard] Resident touch mode toggled:', newValue);
            return newValue;
          });
        } else {
          // 通常モード：enableManualCameraを切り替え（OFFの時がお触りモードON）
          setEnableManualCamera(prev => {
            const newValue = !prev;
            console.log('[Keyboard] Manual camera toggled (touch mode):', !newValue);
            return newValue;
          });
        }
      } else if (key === keyBindings.cameraFollow) {
        // カメラ自動追従切り替え
        setEnableCameraFollow(prev => {
          const newValue = !prev;
          console.log('[Keyboard] Camera follow toggled:', newValue);
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isResidentMode, keyBindings]);

  const fallbackStateRef = useRef({ active: null, lastTriggered: 0, nextSwitchAt: 0, mode: 'primary' });

  const randomBetween = useCallback((min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, []);

  const buttonStyle = (highlight = false) => ({
    padding: '10px 12px',
    background: highlight ? 'linear-gradient(90deg,#4e9af7,#2563eb)' : 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.5px'
  });

  const cancelButtonStyle = {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: '#bbb',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const ensureMotionLoaded = useCallback(async (motionKey) => {
    const manager = vrmaManagerRef.current;
    const info = MOTION_LIBRARY[motionKey];
    if (!manager || !info) {
      return null;
    }

    const alreadyLoaded = motionPreloadRef.current.has(motionKey) || manager.getAnimationNames().includes(motionKey);
    if (!alreadyLoaded) {
      await manager.loadAnimation(motionKey, info.file);
      motionPreloadRef.current.add(motionKey);
    }

    // アニメーションクリップのdurationを取得
    const duration = manager.getDuration(motionKey);
    return { ...info, duration };
  }, []);

  const applyMmdMotionUrl = useCallback(async (url, primaryHint, manualLoopCount = null) => {
    if (!url) {
      console.log('[App] applyMmdMotionUrl: no url provided');
      return;
    }

    // 自動モーション切り替えではリセット不要
    // インタラクション時のリセットはhandleMmdInteractionMotionで5回に1回実施

    const primaryUrl = primaryHint ?? mmdPrimaryMotionUrl ?? url;
    const isPrimary = url === primaryUrl;
    const mode = isPrimary ? 'primary' : 'variant';

    // ループ回数を決定（手動モードの場合は指定された回数を使用）
    let loopCount;
    if (manualLoopCount !== null) {
      // 手動モード：指定された回数を使用（無限ループは-1、それ以外は指定値）
      loopCount = manualLoopCount === -1 ? 999999 : manualLoopCount;
      console.log(`[MMD Manual] Motion "${url}" will play ${manualLoopCount === -1 ? 'infinite' : manualLoopCount} loops`);
    } else {
      // 自動モード：ランダムな回数を決定
      loopCount = isPrimary
        ? randomBetween(2, 3)
        : randomBetween(1, 2);
      console.log(`[MMD Auto] Motion "${url}" will play ${loopCount} loops`);
    }

    // モーション切り替えカウントと手動再生状態は保持する
    const currentSwitchCount = mmdFallbackRef.current.switchCount || 0;
    const currentManualPlayback = mmdFallbackRef.current.manualPlayback;
    mmdFallbackRef.current = {
      active: url,
      mode,
      switchCount: currentSwitchCount,
      isManual: manualLoopCount !== null, // 手動再生フラグ
      manualPlayback: currentManualPlayback // 手動再生データを保持
    };

    setMmdTargetLoopCount(loopCount);

    // ★refから前回のURLを取得（stateはクリアされている可能性がある）
    const previousUrl = mmdFallbackRef.current.active;
    const isSameUrl = previousUrl === url;

    console.log('[App] applyMmdMotionUrl:', { url, isPrimary, mode, loopCount, previousUrl, isSameUrl });

    // ★同じURLでも再適用できるように、一度nullにしてから設定
    if (isSameUrl) {
      console.log('[App] Same URL detected - clearing and reapplying');
      setMmdActiveMotionUrl(null);
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    setMmdActiveMotionUrl(url);
  }, [mmdPrimaryMotionUrl, randomBetween, mmdActiveMotionUrl]);

  const handleMmdAnimationDuration = useCallback((url, duration) => {
    if (url && duration > 0) {
      mmdAnimationDurationsRef.current.set(url, duration);
      console.log(`[App] MMD animation duration stored: ${url} -> ${duration}s`);
    }
  }, []);

  // MMDループ完了時のコールバック
  const handleMmdLoopComplete = useCallback(async (reachedTargetLoops = true) => {
    console.log('[App] MMD loop complete callback called, reachedTargetLoops:', reachedTargetLoops);
    // 自動話しかけ中以外で、インタラクション中やジェスチャー中はスキップ
    if ((isTyping || currentGesture || isSpeaking) && !isAutoTalking) {
      console.log('[App] Skipping motion switch - isTyping:', isTyping, 'currentGesture:', currentGesture, 'isSpeaking:', isSpeaking);
      return;
    }

    const state = mmdFallbackRef.current;

    // 手動再生モードの処理
    if (isManualPlaying && state.manualPlayback) {
      const { targetLoops } = state.manualPlayback;
      console.log(`[Manual] Loop completed, reachedTargetLoops: ${reachedTargetLoops}, targetLoops: ${targetLoops === -1 ? 'infinite' : targetLoops}`);

      // 無限ループの場合は継続
      if (targetLoops === -1) {
        console.log('[Manual] Infinite loop - continuing');
        if (!reachedTargetLoops) {
          // まだループ中
          return;
        }
        const currentMotion = state.active;
        if (currentMotion) {
          setMmdActiveMotionUrl(null);
          await new Promise(resolve => setTimeout(resolve, 50));
          applyMmdMotionUrl(currentMotion, null, targetLoops);
        }
        return;
      }

      // 指定ループ回数に達したか確認
      if (reachedTargetLoops) {
        console.log('[Manual] Target loops reached - returning to auto mode');
        setIsManualPlaying(false);
        state.manualPlayback = null;
        state.isManual = false; // 手動再生フラグをクリア
        // 自動モードに戻る
        playMmdFallbackMotion(false);
        return;
      } else {
        // まだループが残っている場合は継続
        console.log('[Manual] Continuing manual playback (loop not finished yet)');
        return;
      }
    }

    // 各ループごとにカウンターを増やす
    state.switchCount = (state.switchCount || 0) + 1;
    console.log(`[App] Motion switch count: ${state.switchCount}/${mmdResetBoneInterval}`);

    // N回切り替えごとにポーズを初期化
    if (state.switchCount >= mmdResetBoneInterval) {
      console.log(`[App] Resetting pose after ${mmdResetBoneInterval} motion switches...`);
      if (vrmViewerRef.current?.resetBones) {
        await vrmViewerRef.current.resetBones();
        console.log('[App] Pose reset complete');
      }
      state.switchCount = 0;

      // ★クローン再構築後、最小限の待機（メッシュ置き換え完了を待つ）
      console.log('[App] Waiting for mesh replacement to complete...');
      await new Promise(resolve => setTimeout(resolve, 10));

      // ★重要：クローン再構築後は空の状態なので、必ずモーションを適用
      const preferDifferent = state.mode === 'primary' && reachedTargetLoops;
      console.log('[App] Applying motion after reset, preferDifferent:', preferDifferent, 'reachedTarget:', reachedTargetLoops);
      playMmdFallbackMotion(preferDifferent);
    } else if (reachedTargetLoops) {
      // リセットなしで目標ループ達成：通常の切り替え
      const preferDifferent = state.mode === 'primary';
      console.log('[App] Switching to next motion, preferDifferent:', preferDifferent);
      playMmdFallbackMotion(preferDifferent);
    }
  }, [isTyping, currentGesture, isSpeaking, isManualPlaying, isAutoTalking, playMmdFallbackMotion, applyMmdMotionUrl]);

  // MMDインタラクション回数カウンター
  const mmdInteractionCountRef = useRef(0);

  // MMDインタラクション時のモーション切り替え
  const handleMmdInteractionMotion = useCallback(async (interactionType) => {
    console.log(`[App] MMD interaction: ${interactionType}`);

    // tapの場合のみ処理（pet時は物理演算のみ）
    if (interactionType !== 'tap') {
      return;
    }

    // ボーンの揺れアニメーションが終わるまで待機（約2秒）
    console.log('[App] Waiting for tap animation to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // クローン再構築（定期リセットと同じ処理）
    console.log('[App] Tap animation complete - rebuilding clone...');
    if (vrmViewerRef.current?.resetBones) {
      await vrmViewerRef.current.resetBones();
      console.log('[App] Clone rebuild complete');
    }

    // クローン再構築後、最小限の待機（メッシュ置き換え完了を待つ）
    await new Promise(resolve => setTimeout(resolve, 10));

    // tapモーションまたはvariantモーションを再生
    const tapUrls = mmdTapMotionUrlsRef.current || [];
    const variantUrls = mmdVariantMotionUrlsRef.current || [];

    if (tapUrls.length > 0) {
      // tapモーションがある場合はランダムに選択
      const randomTapUrl = tapUrls[Math.floor(Math.random() * tapUrls.length)];
      console.log('[App] Playing tap motion:', randomTapUrl);
      await applyMmdMotionUrl(randomTapUrl, mmdPrimaryMotionUrlRef.current);
    } else if (variantUrls.length > 0) {
      // tapモーションがない場合はvariantから選択
      const randomVariantUrl = variantUrls[Math.floor(Math.random() * variantUrls.length)];
      console.log('[App] No tap motion available, playing variant:', randomVariantUrl);
      await applyMmdMotionUrl(randomVariantUrl, mmdPrimaryMotionUrlRef.current);
    } else {
      // 何もない場合はprimaryモーションを再生
      console.log('[App] No tap/variant motion, playing primary');
      playMmdFallbackMotion(false);
    }
  }, [applyMmdMotionUrl, playMmdFallbackMotion]);

  const playMmdMotion = useCallback((motionKey) => {
    if (!mmdResources?.animations?.length) {
      return;
    }
    if (!motionKey) {
      if (mmdPrimaryMotionUrl) {
        applyMmdMotionUrl(mmdPrimaryMotionUrl);
      }
      return;
    }

    if (motionKey.startsWith?.('blob:')) {
      applyMmdMotionUrl(motionKey);
      return;
    }

    const candidates = mmdResources.animations;
    const keyLower = motionKey.toLowerCase();
    const sanitizedKey = sanitizeMotionKey(motionKey);
    const hintKeywords = [
      keyLower,
      ...(MMD_MOTION_HINTS[keyLower] || []),
      ...(MMD_MOTION_HINTS[motionKey] || [])
    ].map(sanitizeMotionKey).filter(Boolean);

    const findMatch = (predicate) => candidates.find((item) => {
      const normalized = (item.normalized || item.name || '').toLowerCase();
      const sanitized = item.sanitized || sanitizeMotionKey(item.normalized || item.name || '');
      return predicate({ normalized, sanitized, item });
    });

    let match = null;
    if (sanitizedKey) {
      match = findMatch(({ sanitized }) => sanitized.includes(sanitizedKey));
    }
    if (!match && hintKeywords.length) {
      match = findMatch(({ sanitized, normalized }) => hintKeywords.some((hint) => sanitized.includes(hint) || normalized.includes(hint)));
    }
    if (!match && sanitizedKey) {
      match = findMatch(({ normalized }) => normalized.includes(keyLower));
    }

    const primaryCandidate = candidates.find((item) => item.url === mmdPrimaryMotionUrl);
    const fallbackAnim = match || primaryCandidate || candidates[0];
    if (fallbackAnim?.url) {
      applyMmdMotionUrl(fallbackAnim.url);
    }
  }, [mmdResources, mmdPrimaryMotionUrl, applyMmdMotionUrl]);

  const playMmdFallbackMotion = useCallback((preferDifferent = false) => {
    const primaryUrls = mmdPrimaryMotionUrlRef.current;
    if (!primaryUrls || !primaryUrls.length) {
      console.log('[MMD] No primary motion URL available');
      return;
    }

    const state = mmdFallbackRef.current;
    const variants = mmdVariantMotionUrlsRef.current;
    console.log('[MMD] playMmdFallbackMotion called, preferDifferent:', preferDifferent, 'primary count:', primaryUrls.length, 'variants count:', variants.length);

    // プライマリからランダムに選択（デフォルト）
    let nextUrl = primaryUrls[Math.floor(Math.random() * primaryUrls.length)];

    if (preferDifferent && variants.length) {
      // プライマリから切り替える時：50%でバリエーション、50%で別のプライマリ
      if (Math.random() < 0.5) {
        const filtered = variants.filter((url) => url !== state.active);
        const pool = filtered.length ? filtered : variants;
        nextUrl = pool[Math.floor(Math.random() * pool.length)];
        console.log('[MMD] Selected variant from pool of', pool.length);
      } else {
        // 別のプライマリを選ぶ
        console.log('[MMD] state.active:', state.active);
        console.log('[MMD] primaryUrls:', primaryUrls);
        const filtered = primaryUrls.filter((url) => url !== state.active);
        console.log('[MMD] filtered count:', filtered.length);
        const pool = filtered.length ? filtered : primaryUrls;
        nextUrl = pool[Math.floor(Math.random() * pool.length)];
        console.log('[MMD] Selected different primary from pool of', pool.length);
      }
    } else if (!preferDifferent && variants.length) {
      // バリエーションから切り替える時：50%でプライマリ、50%で別のバリエーション
      if (Math.random() < 0.5) {
        nextUrl = primaryUrls[Math.floor(Math.random() * primaryUrls.length)];
        console.log('[MMD] Returning to primary (selected from', primaryUrls.length, 'options)');
      } else {
        const filtered = variants.filter((url) => url !== state.active);
        const pool = filtered.length ? filtered : variants;
        nextUrl = pool[Math.floor(Math.random() * pool.length)];
        console.log('[MMD] Continuing with different variant from pool of', pool.length);
      }
    }

    const isPrimary = primaryUrls.includes(nextUrl);
    state.mode = isPrimary ? 'primary' : 'variant';
    console.log('[MMD] Switching motion from', state.active, 'to', nextUrl, `(${isPrimary ? 'primary' : 'variant'})`);
    state.active = nextUrl;
    applyMmdMotionUrl(nextUrl, isPrimary ? primaryUrls[0] : null);
  }, [applyMmdMotionUrl]);

  const pickFallbackMotion = useCallback((avoidKey = null) => {
    const skipSet = new Set();
    if (avoidKey) {
      skipSet.add(avoidKey);
    }

    const candidates = ALL_IDLE_MOTIONS.filter((key) => !skipSet.has(key));
    if (!candidates.length) {
      return ALL_IDLE_MOTIONS[0];
    }

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }, []);

  // 手動モーション再生
  const playManualMotion = useCallback(async (motionData, loops) => {
    if (!motionData) {
      console.log('[Manual] No motion data provided');
      return;
    }

    console.log('[Manual] Playing motion:', motionData, 'loops:', loops);
    setIsManualPlaying(true);

    // ループ回数を保存（無限ループの場合は-1）
    const targetLoops = loops === 'infinite' ? -1 : parseInt(loops, 10);

    // 手動再生用のrefに設定を保存
    if (!mmdFallbackRef.current.manualPlayback) {
      mmdFallbackRef.current.manualPlayback = {};
    }
    mmdFallbackRef.current.manualPlayback.targetLoops = targetLoops;
    mmdFallbackRef.current.manualPlayback.currentLoops = 0;

    // クローン再構築（定期リセットと同じ処理）
    console.log('[Manual] Resetting pose with clone reconstruction...');
    if (vrmViewerRef.current?.resetBones) {
      await vrmViewerRef.current.resetBones();
      console.log('[Manual] Pose reset complete');
    }

    // メッシュ置き換え完了を待つ
    console.log('[Manual] Waiting for mesh replacement to complete...');
    await new Promise(resolve => setTimeout(resolve, 10));

    // インポートモーションの場合は、Base64からBlobを作成
    if (typeof motionData === 'object' && motionData.imported && motionData.data) {
      try {
        console.log('[Manual] Converting imported motion from Base64');

        // Base64をバイナリに変換
        const binaryString = atob(motionData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // BlobとObjectURLを作成
        const mimeType = motionData.fileType === 'zip' ? 'application/zip' : 'application/octet-stream';
        const blob = new Blob([bytes], { type: mimeType });
        const fileName = `${motionData.name}.${motionData.fileType}`;
        const file = new File([blob], fileName, { type: mimeType });

        // ZIPの場合は展開
        if (motionData.fileType === 'zip') {
          const extracted = await extractMmdZip(file);
          if (extracted && extracted.resources.animations.length > 0) {
            const motionUrl = extracted.resources.animations[0].url;
            console.log('[Manual] Imported ZIP motion URL:', motionUrl);
            applyMmdMotionUrl(motionUrl, null, targetLoops);
          }
        } else {
          // VMDの場合は直接ObjectURLを作成
          const objectURL = URL.createObjectURL(file);
          console.log('[Manual] Imported VMD motion URL:', objectURL);
          applyMmdMotionUrl(objectURL, null, targetLoops);
        }
      } catch (error) {
        console.error('[Manual] Failed to convert imported motion:', error);
        alert('インポートモーションの読み込みに失敗しました');
      }
    } else {
      // 通常のモーション（URLを直接使用）
      const motionUrl = typeof motionData === 'string' ? motionData : motionData.url;
      applyMmdMotionUrl(motionUrl, null, targetLoops);
    }
  }, [applyMmdMotionUrl, extractMmdZip]);

  // お気に入りトグル
  const toggleFavorite = useCallback((motion) => {
    const motionId = motion.imported ? `imported_${motion.name}_${motion.timestamp}` : motion.url;

    setFavoriteMotions(prev => {
      const prevArray = Array.isArray(prev) ? prev : [];
      const isFavorite = prevArray.some(fav => {
        const favId = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.url;
        return favId === motionId;
      });

      let updated;
      if (isFavorite) {
        // お気に入りから削除
        updated = prevArray.filter(fav => {
          const favId = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.url;
          return favId !== motionId;
        });
      } else {
        // お気に入りに追加
        updated = [...prevArray, motion];
      }

      return updated;
    });
  }, []);

  // お気に入りチェック
  const isFavorite = useCallback((motion) => {
    if (!Array.isArray(favoriteMotions)) return false;
    const motionId = motion.imported ? `imported_${motion.name}_${motion.timestamp}` : motion.url;
    return favoriteMotions.some(fav => {
      const favId = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.url;
      return favId === motionId;
    });
  }, [favoriteMotions]);

  // 音街ウナモーション自動認識
  const detectOtomachiUnaMotion = useCallback((fileName) => {
    const baseName = fileName.replace(/\.(zip|vmd)$/i, '');

    // 完全一致チェック
    if (OTOMACHI_UNA_MOTIONS[baseName]) {
      return OTOMACHI_UNA_MOTIONS[baseName].category;
    }

    // 部分一致チェック（大文字小文字を無視）
    const lowerName = baseName.toLowerCase();
    for (const [key, value] of Object.entries(OTOMACHI_UNA_MOTIONS)) {
      if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
        return value.category;
      }
    }

    return null; // 認識できない場合
  }, []);

  // モーションインポート処理
  const handleMotionImport = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const importResults = [];

    for (const file of files) {
      try {
        console.log('[Import] Processing:', file.name);

        // 音街ウナモーション自動認識
        const detectedCategory = detectOtomachiUnaMotion(file.name);
        console.log('[Import] Detected category:', detectedCategory || 'none');

        // ファイルをArrayBufferとして読み込み
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // ZIPファイルの場合
        if (file.name.endsWith('.zip')) {
          const extracted = await extractMmdZip(file);
          if (extracted && extracted.resources.animations.length > 0) {
            const newMotion = {
              name: file.name.replace('.zip', ''),
              type: 'imported',
              imported: true,
              timestamp: Date.now(),
              fileType: 'zip',
              data: base64, // Base64エンコードされたデータ
              category: detectedCategory || 'variants' // 自動認識カテゴリ（デフォルトはVariants）
            };

            console.log('[Import] Adding ZIP motion to state:', newMotion.name, 'category:', newMotion.category);
            setImportedMotions(prev => {
              console.log('[Import] Previous imported motions:', prev.length);
              const updated = [...prev, newMotion];
              console.log('[Import] Updated imported motions:', updated.length);
              return updated;
            });

            importResults.push({ name: file.name, category: newMotion.category });
            console.log('[Import] ZIP imported successfully:', file.name);
          }
        }
        // VMDファイルの場合
        else if (file.name.endsWith('.vmd')) {
          const newMotion = {
            name: file.name.replace('.vmd', ''),
            type: 'imported',
            imported: true,
            timestamp: Date.now(),
            fileType: 'vmd',
            data: base64, // Base64エンコードされたデータ
            category: detectedCategory || 'variants' // 自動認識カテゴリ（デフォルトはVariants）
          };

          console.log('[Import] Adding VMD motion to state:', newMotion.name, 'category:', newMotion.category);
          setImportedMotions(prev => {
            console.log('[Import] Previous imported motions:', prev.length);
            const updated = [...prev, newMotion];
            console.log('[Import] Updated imported motions:', updated.length);
            return updated;
          });

          importResults.push({ name: file.name, category: newMotion.category });
          console.log('[Import] VMD imported successfully:', file.name);
        }
      } catch (error) {
        console.error('[Import] Failed to import:', file.name, error);
        alert(`モーションのインポートに失敗しました: ${file.name}`);
      }
    }

    // インポート完了ダイアログ
    if (importResults.length > 0) {
      const categoryNames = {
        primary: 'Primary（メイン）',
        variants: 'Variants（バリエーション）',
        tap: 'Tap（タップ時）',
        pet: 'Pet（撫でる時）'
      };

      const message = importResults.map(r =>
        `✓ ${r.name}\n→ ${categoryNames[r.category] || r.category}`
      ).join('\n\n');

      alert(`モーションをインポートしました！\n\n${message}`);
    }

    // ファイル選択をリセット
    event.target.value = '';
  }, [detectOtomachiUnaMotion]);

  // インポートモーション削除
  const deleteImportedMotion = useCallback(async (motion) => {
    if (confirm(`「${motion.name}」を削除しますか？`)) {
      // mmdResourcesから該当するURLを探してrevoke
      if (mmdResources?.animations) {
        const targetAnimations = mmdResources.animations.filter(anim =>
          anim.category === motion.category && anim.name && anim.name.includes(motion.name)
        );
        targetAnimations.forEach(anim => {
          if (anim.url && anim.url.startsWith('blob:')) {
            console.log('[Import] Revoking object URL:', anim.url);
            URL.revokeObjectURL(anim.url);
          }
        });
      }

      // 削除後の新しい配列を作成
      const newImportedMotions = importedMotions.filter(m =>
        !(m.imported && m.timestamp === motion.timestamp && m.name === motion.name)
      );
      const newFavoriteMotions = favoriteMotions.filter(m =>
        !(m.imported && m.timestamp === motion.timestamp && m.name === motion.name)
      );

      // 状態を更新
      setImportedMotions(newImportedMotions);
      setFavoriteMotions(newFavoriteMotions);

      // IndexedDBに即座に保存
      await saveImportedMotions(newImportedMotions);
      await saveFavoriteMotions(newFavoriteMotions);

      // 削除後、モーションリソースを再読み込みするために参照をリセット
      hasLoadedAdditionalMotionsRef.current = false;
      previousImportedMotionsCountRef.current = 0; // カウントもリセット

      console.log('[Import] Motion deleted and saved:', motion.name);
    }
  }, [mmdResources, importedMotions, favoriteMotions]);

  // モデルインポート処理
  const handleModelImport = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let file of files) {
      try {
        console.log('[Import] Importing model:', file.name);

        // ファイルをArrayBufferとして読み込み
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // モデルタイプを判定
        let fileType;
        let modelName;

        if (file.name.endsWith('.vrm')) {
          fileType = 'vrm';
          modelName = file.name.replace('.vrm', '');
        } else if (file.name.endsWith('.zip')) {
          // ZIPの場合はMMDモデル
          fileType = 'mmd';
          modelName = file.name.replace('.zip', '');
        } else {
          alert(`サポートされていないファイル形式です: ${file.name}\n(.vrm, .zip[MMD] のみ対応)`);
          continue;
        }

        const newModel = {
          name: modelName,
          type: fileType,
          imported: true,
          timestamp: Date.now(),
          fileType: fileType,
          data: base64 // Base64エンコードされたデータ
        };

        setImportedModels(prev => [...prev, newModel]);
        console.log('[Import] Model imported successfully:', file.name);
      } catch (error) {
        console.error('[Import] Failed to import model:', file.name, error);
        alert(`モデルのインポートに失敗しました: ${file.name}`);
      }
    }

    // ファイル選択をリセット
    event.target.value = '';
  }, []);

  // モデルお気に入りトグル
  const toggleFavoriteModel = useCallback((model) => {
    const modelId = model.imported ? `imported_${model.name}_${model.timestamp}` : model.path || model.name;

    setFavoriteModels(prev => {
      const prevArray = Array.isArray(prev) ? prev : [];
      const isFavorite = prevArray.some(fav => {
        const favId = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.path || fav.name;
        return favId === modelId;
      });

      let updated;
      if (isFavorite) {
        // お気に入りから削除
        updated = prevArray.filter(fav => {
          const favId = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.path || fav.name;
          return favId !== modelId;
        });
      } else {
        // お気に入りに追加
        updated = [...prevArray, model];
      }

      return updated;
    });
  }, []);

  // モデルお気に入りチェック
  const isFavoriteModel = useCallback((model) => {
    if (!Array.isArray(favoriteModels)) return false;
    const modelId = model.imported ? `imported_${model.name}_${model.timestamp}` : model.path || model.name;
    return favoriteModels.some(fav => {
      const favId = fav.imported ? `imported_${fav.name}_${fav.timestamp}` : fav.path || fav.name;
      return favId === modelId;
    });
  }, [favoriteModels]);

  // モデル切り替え
  const switchModel = useCallback(async (model) => {
    try {
      console.log('[Model Switch] Switching to:', model);

      if (model.imported && model.data) {
        // インポートモデルの場合、Base64からBlobを作成
        const binaryString = atob(model.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        if (model.fileType === 'vrm') {
          // VRMモデルの場合
          const mimeType = 'model/gltf-binary';
          const blob = new Blob([bytes], { type: mimeType });
          const objectURL = URL.createObjectURL(blob);

          // 古いMMDリソースをクリア
          if (mmdResources) {
            revokeResourceUrls(mmdResources);
            setMmdResources(null);
          }
          setMmdActiveMotionUrl(null);

          // ref をリセット
          vrmaManagerRef.current = null;
          motionPreloadRef.current = new Set();
          fallbackStateRef.current = {
            active: null,
            lastTriggered: Date.now(),
            nextSwitchAt: 0,
            mode: 'primary'
          };

          setModelUrl(objectURL);
          setModelType('vrm');
          setSelectedModel(model);

          // VRMViewerを再マウントしてモデルをロード
          setWebglResetKey(prev => prev + 1);

          console.log('[Model Switch] Switched to imported VRM model:', model.name);
        } else if (model.fileType === 'mmd') {
          // MMDモデル（ZIP）の場合、展開が必要
          const blob = new Blob([bytes], { type: 'application/zip' });
          const file = new File([blob], `${model.name}.zip`, { type: 'application/zip' });

          // ZIPを展開してmmdResourcesを作成
          const extracted = await extractMmdZip(file);
          if (extracted && extracted.model && extracted.model.url) {
            // 古いMMDリソースをクリア
            if (mmdResources) {
              revokeResourceUrls(mmdResources);
            }

            // 新しいモデルのために追加モーションを再ロードできるようにフラグをリセット
            hasLoadedAdditionalMotionsRef.current = false;
            previousImportedMotionsCountRef.current = 0;
            // モーションURLの参照もクリアして古いURLを使わないようにする
            mmdPrimaryMotionUrlRef.current = [];
            mmdVariantMotionUrlsRef.current = [];
            mmdVariantAnimationsRef.current = [];
            mmdAllAnimationsRef.current = [];
            // アニメーションdurationのキャッシュもクリア
            mmdAnimationDurationsRef.current.clear();

            setMmdResources(extracted.resources);
            const defaultMotion = extracted.resources.animations?.[0]?.url || null;
            setMmdActiveMotionUrl(defaultMotion);

            // ref をリセット
            vrmaManagerRef.current = null;
            motionPreloadRef.current = new Set();
            fallbackStateRef.current = {
              active: null,
              lastTriggered: Date.now(),
              nextSwitchAt: 0,
              mode: 'primary'
            };

            setModelUrl(extracted.model.url);
            setModelType('mmd');
            setSelectedModel(model);

            // VRMViewerを再マウントしてモデルをロード
            setWebglResetKey(prev => prev + 1);

            console.log('[Model Switch] Switched to imported MMD model:', model.name);
          } else {
            throw new Error('MMDモデルの展開に失敗しました');
          }
        }
      } else if (model.path) {
        // デフォルトモデルの場合
        const targetType = model.type || 'auto';

        if (targetType === 'vrm') {
          // 古いMMDリソースをクリア
          if (mmdResources) {
            revokeResourceUrls(mmdResources);
            setMmdResources(null);
          }
          setMmdActiveMotionUrl(null);

          // ref をリセット
          vrmaManagerRef.current = null;
          motionPreloadRef.current = new Set();
          fallbackStateRef.current = {
            active: null,
            lastTriggered: Date.now(),
            nextSwitchAt: 0,
            mode: 'primary'
          };
        }

        setModelUrl(model.path);
        setModelType(targetType);
        setSelectedModel(model);

        // モデルURLとタイプを保存（blob URLでない場合のみ）
        if (!model.path.startsWith('blob:')) {
          localStorage.setItem('selectedModelUrl', model.path);
          localStorage.setItem('selectedModelType', targetType);
        }

        // VRMViewerを再マウントしてモデルをロード
        setWebglResetKey(prev => prev + 1);

        console.log('[Model Switch] Switched to default model:', model.path);
      }
    } catch (error) {
      console.error('[Model Switch] Failed to switch model:', error);
      alert('モデルの切り替えに失敗しました');
    }
  }, [extractMmdZip, mmdResources, revokeResourceUrls]);

  const applyEmotionAndMotion = useCallback(async (assistantText, fallbackEmotion) => {
    if (modelType === 'mmd') {
      // MMDモデルの場合は、localMotionAI（VRMAベース）を使わず、直接感情分析
      const resolvedEmotion = fallbackEmotion || 'neutral';
      setCurrentEmotion(resolvedEmotion);

      // 感情に基づいてMMDモーションをマッピング
      const emotionToMotion = {
        'happy': 'idle_cheerful',
        'sad': 'sad',
        'surprised': 'surprised',
        'thinking': 'thinking',
        'neutral': 'idle_soft'
      };
      const targetMotion = emotionToMotion[resolvedEmotion] || 'idle_soft';
      playMmdMotion(targetMotion);
      return;
    }

    // VRMモデルの場合は、フォールバックで感情とモーションを決定（LocalMotionAIは無効化）
    fallbackStateRef.current.active = null;
    fallbackStateRef.current.lastTriggered = Date.now();
    fallbackStateRef.current.nextSwitchAt = 0;
    fallbackStateRef.current.mode = 'primary';

    // フォールバックモーションをランダムに選ぶ
    let targetMotion = pickFallbackMotion(null);
    if (!targetMotion) {
      targetMotion = PRIMARY_IDLE_MOTION;
    }

    // モーション名から表情を推測
    const motionEmotion = guessEmotionFromMotion(targetMotion);
    const resolvedEmotion = fallbackEmotion || motionEmotion;
    const intensity = 0.7;
    setCurrentEmotion(resolvedEmotion);
    setEmotionIntensity(intensity);
    console.log(`[Fallback] Motion: ${targetMotion}, Emotion: ${resolvedEmotion} (from motion: ${motionEmotion}), Intensity: ${intensity}`);

    const info = await ensureMotionLoaded(targetMotion);
    if (!info) {
      return;
    }

    const loop = info.loop;

    // カメラを調整
    const newCameraConfig = getMotionCameraConfig(targetMotion);
    setCameraConfig(newCameraConfig);

    vrmaManagerRef.current?.play(targetMotion, {
      loop,
      clampWhenFinished: !loop,
      fadeInDuration: 0.2,
      fadeOutDuration: 0.2
    });
    console.log(`Playing motion: ${targetMotion} (loop: ${loop})`);
  }, [currentEmotion, ensureMotionLoaded, modelType, playMmdMotion, pickFallbackMotion, getMotionCameraConfig]);

  const updateIdleEmotion = useCallback(async () => {
    if (modelType !== 'vrm') {
      return;
    }

    const now = Date.now();
    const idleSeconds = Math.floor((now - lastInteractionTimeRef.current) / 1000);

    console.log(`[Idle] Updating emotion, idle for ${idleSeconds} seconds`);

    // LLMに待機時間を伝えて表情とモーションを提案してもらう
    const history = typeof aiService.getConversationHistory === 'function'
      ? aiService.getConversationHistory()
      : [];

    // LocalMotionAI無効化 - シンプルにランダムで感情とモーションを選択
    try {
      // ランダムにモーションを選ぶ
      let targetMotion = pickFallbackMotion(null);
      if (!targetMotion) {
        targetMotion = PRIMARY_IDLE_MOTION;
      }

      // モーション名から表情を推測
      const motionEmotion = guessEmotionFromMotion(targetMotion);
      const resolvedEmotion = motionEmotion;
      const intensity = 0.5;
      setCurrentEmotion(resolvedEmotion);
      setEmotionIntensity(intensity);
      console.log(`[Idle] Motion: ${targetMotion}, Emotion: ${resolvedEmotion} (from motion), Intensity: ${intensity}`);

      const info = await ensureMotionLoaded(targetMotion);
      if (info) {
        // fallbackStateを更新（durationベース）
        const fallbackState = fallbackStateRef.current;
        const now = Date.now();
        fallbackState.active = targetMotion;
        fallbackState.lastTriggered = now;
        fallbackState.mode = targetMotion === PRIMARY_IDLE_MOTION ? 'primary' : 'variant';

        // モーションのdurationを取得して切り替えタイミングを計算
        let dwellDuration;
        const motionDuration = info.duration || 0;
        const isLoop = info.loop;

        if (isLoop && motionDuration > 0) {
          // ループモーションの場合：durationの3-5倍の時間再生
          const loopCount = fallbackState.mode === 'primary'
            ? randomBetween(3, 5)
            : randomBetween(1, 3);
          dwellDuration = motionDuration * 1000 * loopCount;
          console.log(`[Idle] Loop motion "${targetMotion}" duration: ${motionDuration}s, will play ${loopCount} loops (${dwellDuration}ms)`);
        } else if (motionDuration > 0) {
          // 非ループモーションの場合：duration + 少し余裕
          dwellDuration = motionDuration * 1000 + 500;
          console.log(`[Idle] One-shot motion "${targetMotion}" duration: ${motionDuration}s (${dwellDuration}ms)`);
        } else {
          // durationが取れない場合はフォールバック
          dwellDuration = fallbackState.mode === 'primary'
            ? randomBetween(18000, 32000)
            : randomBetween(6000, 10000);
          console.log(`[Idle] No duration info for "${targetMotion}", using fallback: ${dwellDuration}ms`);
        }

        fallbackState.nextSwitchAt = now + dwellDuration;

        // カメラを調整
        const newCameraConfig = getMotionCameraConfig(targetMotion);
        setCameraConfig(newCameraConfig);

        vrmaManagerRef.current?.play(targetMotion, {
          loop: isLoop,
          clampWhenFinished: !isLoop,
          fadeInDuration: 0.6,
          fadeOutDuration: 0.4
        });
      }
    } catch (error) {
      console.error('[Idle] Failed to update emotion:', error);
    }
  }, [modelType, currentEmotion, ensureMotionLoaded, getMotionCameraConfig, pickFallbackMotion, randomBetween]);

  const playFallbackMotion = useCallback(async (options = {}) => {
    if (modelType !== 'vrm') {
      return;
    }
    const { preferDifferent = false } = options;
    const manager = vrmaManagerRef.current;
    if (!manager) {
      return;
    }

    const fallbackState = fallbackStateRef.current;
    const avoidKey = preferDifferent ? fallbackState.active : null;

    // プライマリモーション（20%）またはランダムなバリエーション（80%）
    let nextKey;
    if (Math.random() < 0.2) {
      nextKey = PRIMARY_IDLE_MOTION;
    } else {
      nextKey = pickFallbackMotion(avoidKey);
    }

    const currentName = typeof manager.getCurrentAnimationName === 'function'
      ? manager.getCurrentAnimationName()
      : null;
    if (currentName === nextKey && typeof manager.isPlaying === 'function' && manager.isPlaying()) {
      fallbackState.active = nextKey;
      fallbackState.mode = nextKey === PRIMARY_IDLE_MOTION ? 'primary' : 'variant';
      return;
    }

    const info = await ensureMotionLoaded(nextKey);
    if (!info) {
      return;
    }

    const now = Date.now();
    fallbackState.active = nextKey;
    fallbackState.lastTriggered = now;
    fallbackState.mode = nextKey === PRIMARY_IDLE_MOTION ? 'primary' : 'variant';
    fallbackState.isManual = false; // 自動再生フラグをリセット

    // モーションのdurationを取得して切り替えタイミングを計算
    let dwellDuration;
    const motionDuration = info.duration || 0;

    if (info.loop && motionDuration > 0) {
      // ループモーションの場合：durationの2-4倍の時間再生
      const loopCount = fallbackState.mode === 'primary'
        ? randomBetween(3, 5)
        : randomBetween(1, 3);
      dwellDuration = motionDuration * 1000 * loopCount; // ミリ秒に変換
      console.log(`[Motion] Loop motion "${nextKey}" duration: ${motionDuration}s, will play ${loopCount} loops (${dwellDuration}ms)`);
    } else if (motionDuration > 0) {
      // 非ループモーションの場合：duration + 少し余裕
      dwellDuration = motionDuration * 1000 + 500;
      console.log(`[Motion] One-shot motion "${nextKey}" duration: ${motionDuration}s (${dwellDuration}ms)`);
    } else {
      // durationが取れない場合はフォールバック
      dwellDuration = fallbackState.mode === 'primary'
        ? randomBetween(18000, 32000)
        : randomBetween(6000, 10000);
      console.log(`[Motion] No duration info for "${nextKey}", using fallback: ${dwellDuration}ms`);
    }

    fallbackState.nextSwitchAt = now + dwellDuration;

    // カメラを調整
    const newCameraConfig = getMotionCameraConfig(nextKey);
    setCameraConfig(newCameraConfig);

    manager.play(nextKey, {
      loop: true,
      fadeInDuration: 1.0,
      fadeOutDuration: 1.5,
      clampWhenFinished: false
    });
  }, [ensureMotionLoaded, pickFallbackMotion, randomBetween, modelType, getMotionCameraConfig]);

  useEffect(() => {
    if (modelType !== 'vrm') {
      return undefined;
    }

    const interval = setInterval(() => {
      (async () => {
        const manager = vrmaManagerRef.current;
        if (!manager) {
          return;
        }

        if (isTyping || currentGesture) {
          return;
        }

        const now = Date.now();
        const currentName = typeof manager.getCurrentAnimationName === 'function'
          ? manager.getCurrentAnimationName()
          : null;

        if (typeof manager.isPlaying === 'function' && manager.isPlaying()) {
          if (currentName && currentName !== fallbackStateRef.current.active) {
            fallbackStateRef.current.active = null;
            fallbackStateRef.current.nextSwitchAt = 0;
            fallbackStateRef.current.isManual = false;
          }

          // 手動再生の場合は自動切り替えしない
          if (fallbackStateRef.current.isManual) {
            return;
          }

          if (fallbackStateRef.current.active && currentName === fallbackStateRef.current.active) {
            if (now >= fallbackStateRef.current.nextSwitchAt) {
              await playFallbackMotion({ preferDifferent: true });
            }
          }
          return;
        }

        if (now - fallbackStateRef.current.lastTriggered < 1500) {
          return;
        }

        await playFallbackMotion();
      })().catch((error) => console.error('Fallback motion error:', error));
    }, 2000);

    return () => clearInterval(interval);
  }, [playFallbackMotion, isTyping, currentGesture, modelType]);

  // 待機時間に応じた表情変化
  useEffect(() => {
    if (modelType !== 'vrm') {
      console.log('[Idle] Effect skipped, modelType:', modelType);
      return undefined;
    }

    console.log('[Idle] Setting up 15-second interval for emotion updates');

    const interval = setInterval(() => {
      console.log('[Idle] 15-second interval triggered');
      updateIdleEmotion().catch((error) => {
        console.error('[Idle] Emotion update error:', error);
      });
    }, 15000); // 15秒ごとにチェック

    return () => {
      console.log('[Idle] Cleaning up interval');
      clearInterval(interval);
    };
  }, [modelType, updateIdleEmotion]);

  // デフォルトのVRMモデル（無料の公開モデルを使用）
  useEffect(() => {
    // 保存されたモデルを読み込む
    const savedModelUrl = localStorage.getItem('selectedModelUrl');
    const savedModelType = localStorage.getItem('selectedModelType');

    if (savedModelUrl && savedModelType && !savedModelUrl.startsWith('blob:')) {
      // 保存されたURLがblob URLでない場合のみ復元
      setModelUrl(savedModelUrl);
      setModelType(savedModelType);
    } else {
      // デフォルトのAlicia MMDモデル（publicディレクトリ）
      const aliciaModelPath = 'models/alicia/Alicia_solid.pmx';
      setModelUrl(aliciaModelPath);
      setModelType('mmd'); // カメラ設定はuseEffectで自動的に行われる

      // MMDリソース（テクスチャ）を登録
      const resources = createResourceContainer();
      const textureFiles = [
        'Alicia_body.tga',
        'Alicia_eye.tga',
        'Alicia_face.tga',
        'Alicia_hair.tga',
        'Alicia_other.tga',
        'Alicia_rod.tga',
        'Alicia_wear.tga',
        'blade_s.bmp',
        'eye_s.bmp',
        'face_s.bmp',
        'hair_s.bmp',
        'ramp_s.bmp',
        'rod_s.bmp',
        'shoes_s.bmp',
        'skin_s.bmp',
        'tongue_s.bmp'
      ];

      textureFiles.forEach(fileName => {
        const filePath = `models/alicia/${fileName}`;
        addResourceToMap(resources, fileName, filePath);
        addResourceToMap(resources, filePath, filePath);
      });

      // モデルファイル自体も登録
      addResourceToMap(resources, 'Alicia_solid.pmx', aliciaModelPath);
      addResourceToMap(resources, aliciaModelPath, aliciaModelPath);

      setMmdResources(resources);
      console.log('[App] Loaded default Alicia MMD model with resources');
    }

    // 保存されたAPIキー、システムプロンプト、タップインタラクションプロンプトを読み込む
    const savedApiKey = localStorage.getItem('openaiApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    const savedPrompt = localStorage.getItem('systemPrompt');
    if (savedPrompt) {
      setSystemPrompt(savedPrompt);
    }

    const savedTapPrompts = localStorage.getItem('tapPrompts');
    if (savedTapPrompts) {
      try {
        setTapPrompts(JSON.parse(savedTapPrompts));
      } catch (e) {
        console.error('Failed to parse saved tap prompts:', e);
      }
    }

    // voiceCharacterをlocalStorageから読み込み
    const savedVoiceCharacter = localStorage.getItem('voiceCharacter');
    if (savedVoiceCharacter) {
      setVoiceCharacter(savedVoiceCharacter);
    }

    // 声質パラメータはデフォルト値を使用（VOICEVOX用にリセット）
    // const savedSpeedScale = localStorage.getItem('voiceSpeedScale');
    // if (savedSpeedScale) setVoiceSpeedScale(parseFloat(savedSpeedScale));

    // const savedPitchScale = localStorage.getItem('voicePitchScale');
    // if (savedPitchScale) setVoicePitchScale(parseFloat(savedPitchScale));

    // const savedIntonationScale = localStorage.getItem('voiceIntonationScale');
    // if (savedIntonationScale) setVoiceIntonationScale(parseFloat(savedIntonationScale));

    const savedTtsEngine = localStorage.getItem('ttsEngine');
    // const moeTTSEnabled = localStorage.getItem('enable_moe_tts') === 'true';

    // 有効なengineをチェック（MoeTTS有効時のみmoe-model許可）
    // const validEngines = moeTTSEnabled
    //   ? ['voicevox', 'moe-model12', 'moe-model15']
    //   : ['voicevox'];
    const validEngines = ['voicevox']; // MoeTTS disabled
    const engine = validEngines.includes(savedTtsEngine) ? savedTtsEngine : 'voicevox';

    setTtsEngine(engine);
    localStorage.setItem('ttsEngine', engine);

    // キャラクターリストを初期化
    if (engine === 'voicevox') {
      voicevoxService.initialize().then(() => {
        const styles = voicevoxService.getAllStyles();
        setCharacterList(styles);
        if (!savedVoiceCharacter && styles.length > 0) {
          const defaultVoice = styles.find(s => s === '猫使ビィ (おちつき)');
          setVoiceCharacter(defaultVoice || styles[0]);
        }
      });
    }
    // else if (engine.startsWith('moe-model')) {
    //   const modelId = engine === 'moe-model12' ? 12 : 15;
    //   moeTTSService.getCharacters(modelId).then(chars => {
    //     setCharacterList(chars);
    //     if (!savedVoiceCharacter && chars.length > 0) {
    //       setVoiceCharacter(chars[0]);
    //     }
    //   });
    // }

    // AI初期化ボタンを表示（初回はユーザーアクション必要）
    setAiStatus('not-initialized');
  }, []);

  // AI初期化
  const initializeAI = async () => {
    // .envからAPIキーを取得、なければapiKey stateを使用（オプション）
    const openaiApiKey = apiKey.trim();

    // ライセンスまたはAPIキーのどちらかが必要
    if (!licenseApi.hasValidLicense() && !openaiApiKey) {
      setAiProgress('ライセンスキーまたはOpenAI APIキーを入力してください');
      setIsLicenseModalOpen(true);
      return;
    }

    setAiStatus('loading');
    setAiProgress('AIサービスに接続中...');

    try {
      // ライセンスモードで初期化
      await aiService.initialize(openaiApiKey || 'license-mode', systemPrompt, (progress) => {
        if (progress.text) {
          setAiProgress(progress.text);
        }
      });

      // OpenAI サービスも初期化（インタラクション用）
      await replicateService.initialize(openaiApiKey || 'license-mode');

      setAiStatus('ready');
      setAiProgress('');

      // APIキー、システムプロンプト、音声キャラクター、TTSエンジン、設定をローカルストレージに保存
      if (apiKey) {
        localStorage.setItem('openaiApiKey', apiKey);
      }
      localStorage.setItem('systemPrompt', systemPrompt);
      localStorage.setItem('voiceCharacter', voiceCharacter);
      localStorage.setItem('ttsEngine', ttsEngine);
      localStorage.setItem('enableInteractionVoice', JSON.stringify(enableInteractionVoice));
      localStorage.setItem('enableInteraction', JSON.stringify(enableInteraction));

      // ToolExecutorにタイマー完了コールバックを設定
      toolExecutor.setTimerCompleteCallback(handleTimerComplete);
      console.log('[Timer] Callback registered');

      setChatHistory([{ role: 'assistant', content: 'こんにちは！何かお手伝いできることはありますか？' }]);

      // VAD常時起動（Voskでウェイクワード検出）
      console.log('[VAD] Starting always-on VAD with Vosk for wake word detection...');
      try {
        await voiceRecorder.startRecordingWithVADv3(
          // Whisper APIの結果（連続会話モード中のみ呼ばれる）
          (transcript) => {
            // 終了ワード判定（Whisper結果で判定）
            if (speechRecognition.detectEndWord(transcript, endWordsRef.current)) {
              console.log('[End Word] Detected! Ending conversation mode...');
              isConversationModeRef.current = false;
              setIsConversationMode(false);
              if (conversationTimer) {
                clearTimeout(conversationTimer);
                setConversationTimer(null);
              }
              return;
            }

            // 通常のチャット送信
            if (transcript.trim()) {
              handleSendMessage(true, transcript);
            }
          },
          // エラーハンドラ
          (error) => {
            console.error('[VAD] Error:', error);
          },
          // オプション
          {
            // Voskの結果（ウェイクワード判定のみ）
            onVoskRecognition: (transcript) => {
              console.log('[Vosk] Transcript:', transcript);

              // ウェイクワード判定のみ（最新の設定を参照）
              if (!isConversationModeRef.current && speechRecognition.detectWakeWord(transcript, wakeWordsRef.current)) {
                console.log('[Wake Word] Detected! Starting conversation mode...');
                isConversationModeRef.current = true; // 即座にrefを更新
                setIsConversationMode(true);

                // ランダムな返事をTTSで再生
                if (wakeWordResponses.length > 0) {
                  const randomResponse = wakeWordResponses[Math.floor(Math.random() * wakeWordResponses.length)];
                  console.log('[Wake Word] Responding with:', randomResponse);

                  // 統合TTS関数で再生
                  synthesizeSpeech(randomResponse).catch(error => {
                    console.error('[Wake Word] TTS failed:', error);
                  });
                  // else if (ttsEngine === 'vits-uma') {
                  //   const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
                  //   const characterId = character ? character.id : 0;
                  //   umaVoiceService.speak(randomResponse, {
                  //     characterId: characterId,
                  //     language: 'Japanese',
                  //     speed: 1.0
                  //   });
                  // }
                }

                // 20分タイマー開始
                if (conversationTimer) clearTimeout(conversationTimer);
                const timer = setTimeout(() => {
                  setShowConversationConfirm(true);
                }, 20 * 60 * 1000); // 20分
                setConversationTimer(timer);
              }
            },
            // 連続会話モード判定関数
            isConversationMode: () => isConversationModeRef.current
          }
        );
        console.log('[VAD] Always-on VAD with Vosk started successfully');
      } catch (error) {
        console.error('[VAD] Failed to start always-on VAD:', error);
      }
    } catch (error) {
      console.error('AI initialization failed:', error);
      setAiStatus('error');
      setAiProgress('AI初期化に失敗しました: ' + error.message);
    }
  };

  // プロンプトの変更を自動保存＆AIサービスに反映
  useEffect(() => {
    if (aiStatus === 'ready') {
      localStorage.setItem('systemPrompt', systemPrompt);
      aiService.updateSystemPrompt(systemPrompt);
    }
  }, [systemPrompt, aiStatus]);

  // ライセンス期限チェック（1時間ごと）
  useEffect(() => {
    if (aiStatus !== 'ready') return;

    const checkLicense = async () => {
      if (!licenseApi.hasValidLicense()) return;

      try {
        const result = await licenseApi.verifyLicense();
        if (!result.success) {
          console.log('[License] License expired, disconnecting AI...');
          // ライセンス期限切れ: AI接続解除
          aiService.destroy();
          licenseApi.clearLicense();
          setAiStatus('skipped');
          setChatHistory([]);
          setLicenseInfo(null);
          alert('ライセンスの有効期限が切れました。AI機能を停止しました。');
        }
      } catch (error) {
        console.error('[License] Check error:', error);
      }
    };

    // 初回チェック
    checkLicense();

    // 1時間ごとにチェック
    const interval = setInterval(checkLicense, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [aiStatus]);


  // TTS Modインポートハンドラー
  const handleModImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      console.log('[TTS Mod] Importing:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      await ttsModManager.importMod(arrayBuffer);

      // Mod一覧を更新
      const mods = await ttsModManager.listMods();
      setInstalledMods(mods);

      alert('Modを正常にインポートしました！');
    } catch (error) {
      console.error('[TTS Mod] Import failed:', error);
      alert(`Modのインポートに失敗しました: ${error.message}`);
    }

    // ファイル選択をリセット
    event.target.value = '';
  };

  // TTS Mod削除ハンドラー
  const handleModDelete = async (modId) => {
    if (!confirm('このModを削除しますか？')) return;

    try {
      await ttsModManager.deleteMod(modId);

      // Mod一覧を更新
      const mods = await ttsModManager.listMods();
      setInstalledMods(mods);

      console.log('[TTS Mod] Deleted:', modId);
    } catch (error) {
      console.error('[TTS Mod] Delete failed:', error);
      alert(`Modの削除に失敗しました: ${error.message}`);
    }
  };

  // 統合音声合成関数（VOICEVOX、Modを統一的に扱う）
  const synthesizeSpeech = async (text, options = {}) => {
    try {
      if (ttsEngine === 'voicevox') {
        // VOICEVOX - 既存の実装（再生まで行う）
        return await voicevoxService.speak(text, {
          speaker: voiceCharacter,
          speedScale: voiceSpeedScale,
          volumeScale: 1.0,
          pitchScale: voicePitchScale,
          intonationScale: voiceIntonationScale,
          ...options
        });
      }
      // else if (ttsEngine.startsWith('moe-model')) {
      //   // MoeTTS - 既存の実装（再生まで行う）
      //   const modelId = ttsEngine === 'moe-model12' ? 12 : 15;
      //   return await moeTTSService.speak(text, {
      //     modelId: modelId,
      //     speaker: voiceCharacter,
      //     speed: voiceSpeedScale,
      //     language: ttsLanguage,
      //     ...options
      //   });
      // }
      else if (ttsEngine.startsWith('mod:')) {
        // TTS Mod - Blobを取得して再生
        const modId = ttsEngine.replace('mod:', '');
        const modService = await ttsModManager.loadMod(modId);

        // キャラクター名からIDを取得
        const voices = await modService.getVoices();
        const selectedVoice = voices.find(v => v.name === voiceCharacter);
        const speakerId = selectedVoice ? (selectedVoice.id || selectedVoice.name) : voiceCharacter;

        // Modのspeak()はBlobを返す
        const audioBlob = await modService.speak(text, {
          speaker: speakerId,
          speed: voiceSpeedScale,
          pitch: voicePitchScale,
          language: options.language || 'ja',
          ...options
        });

        // Blobを再生
        if (audioBlob) {
          return new Promise((resolve, reject) => {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              console.log('[TTS Mod] Playback completed');
              resolve();
            };

            audio.onerror = (error) => {
              URL.revokeObjectURL(audioUrl);
              console.error('[TTS Mod] Playback error:', error);
              reject(error);
            };

            audio.play().catch(reject);
          });
        }

        return null;
      } else {
        throw new Error(`Unknown TTS engine: ${ttsEngine}`);
      }
    } catch (error) {
      console.error('[TTS] Synthesis failed:', error);
      throw error;
    }
  };

  // インタラクション重複防止用ref
  const lastInteractionCallRef = useRef(0);

  // インタラクション時の処理（タップ/撫で）- チャット非表示でAPI送信＋音声生成
  const handleInteraction = async (interactionType) => {
    // インタラクション無効時は何もしない
    if (!enableInteraction) {
      console.log('[Interaction] Disabled by user settings');
      return;
    }

    console.log('[App] handleInteraction called:', interactionType, 'AI status:', aiStatus);

    // AIが準備できていない場合はスキップ
    if (aiStatus !== 'ready') {
      console.log('[App] AI not ready, skipping interaction');
      return;
    }

    // チャットTTS再生中は反応ボイスをスキップ
    if (isTTSSpeaking) {
      console.log('[Interaction] Skipping reaction voice - TTS is speaking');
      return;
    }

    // 重複呼び出しを防ぐ（100ms以内の重複は無視）
    const now = Date.now();
    if (now - lastInteractionCallRef.current < 100) {
      console.log('[App] Duplicate interaction call ignored');
      return;
    }
    lastInteractionCallRef.current = now;

    // ユーザーインタラクション時刻を更新
    lastInteractionTimeRef.current = now;

    // インタラクションタイプに応じたプロンプト
    let basePrompt = null;
    let bodyPartForFallback = null; // AI応答のフォールバック用

    // オブジェクト形式（部位情報あり）の場合
    let interactionDetails = '';
    if (typeof interactionType === 'object' && interactionType.type) {
      const { type, bodyPart, boneName, reaction } = interactionType;
      bodyPartForFallback = bodyPart; // フォールバック用に保存

      // インタラクション詳細情報を追記
      if (boneName) {
        const actionText = type === 'tap' ? 'タップ' : type === 'grab' ? '掴まれて引っ張られ' : '撫で';
        interactionDetails = `\n（詳細: ${boneName}を${actionText}た）`;
      }

      if (type === 'tap') {
        // 部位ごとのプロンプト（設定から取得）
        basePrompt = tapPrompts[bodyPart] || tapPrompts.default;
      } else if (type === 'pet') {
        basePrompt = tapPrompts.pet;
      } else if (type === 'grab') {
        // グラブ時のプロンプト（掴まれた時の反応）
        const grabPrompts = {
          skirt: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたのスカートを掴んでめくってきました。恥ずかしがって抗議したり、驚いた反応を返してください。',
          hair: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの髪を掴んで引っ張ってきました。痛がったり、怒ったり、驚いた反応を返してください。',
          accessory: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたのアクセサリーを掴んできました。驚いたり、困惑した反応を返してください。',
          intimate: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの身体の親密な部分を掴んで揉んできました。驚いたり、恥ずかしがったり、少し怒った反応を返してください。',
          head: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの頭を掴んできました。驚いたり、抗議した反応を返してください。',
          shoulder: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの肩を掴んできました。軽く驚いたり、不思議そうに反応してください。',
          arm: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの腕を掴んできました。驚いたり、軽く抗議した反応を返してください。',
          leg: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの足を掴んできました。驚いたり、困惑した反応を返してください。',
          default: 'あなたとユーザーはとても親密な関係です。ユーザーがあなたの身体を掴んできました。自然に反応してください。'
        };
        basePrompt = grabPrompts[bodyPart] || grabPrompts.default;
      }
    } else if (typeof interactionType === 'object' && interactionType.type === 'pet') {
      // 部位別インタラクション無効でも、撫でるは動作させる
      basePrompt = tapPrompts.pet;
    }

    // ボディ以外をタップした場合はプロンプトがnullのままなので、AI呼び出しをスキップ
    if (!basePrompt) {
      console.log('[Interaction] No valid body part detected, skipping AI call');
      return;
    }

    // 履歴から前回のインタラクションを取得して、連続性のあるプロンプトを作成
    let prompt = basePrompt + interactionDetails;

    // 初回の場合
    if (interactionHistory.length < 2 && interactionDetails) {
      prompt += '\n\n※身体部位の名前（上半身、腕、足など）は言わないでください。\n※1〜2文程度で、感情を込めて応答してください。';
    }

    if (interactionHistory.length >= 2) {
      const lastUserPrompt = interactionHistory[interactionHistory.length - 2]?.content;
      const lastAssistantResponse = interactionHistory[interactionHistory.length - 1]?.content;

      if (lastUserPrompt && lastAssistantResponse) {
        // 前回のインタラクション情報をコンテキストとして追加
        prompt = `【前回のインタラクション】
ユーザー: ${lastUserPrompt}
あなた: ${lastAssistantResponse}

【今回のインタラクション】
${basePrompt}${interactionDetails}

※前回の反応を踏まえて、自然に応答してください。
※同じ部位でも毎回違う反応をしてください（照れる、驚く、喜ぶ、困る、ツッコむなど）。
※触られた部位や状況に応じて、素直に感情を込めて反応してください。
※身体部位の名前（上半身、腕、足など）は言わないでください。
※1〜2文程度で、キャラクターらしく応答してください。`;
      }
    }

    // VRMモデルの場合、インタラクション時に idle_sway_alt モーションに切り替え
    if (modelType === 'vrm' && motionControls?.playMotion) {
      console.log('[Interaction] Resetting VRM pose and switching to idle_sway_alt');
      try {
        // 1. 現在のモーションを停止
        if (vrmViewerRef.current?.stopCurrentMotion) {
          vrmViewerRef.current.stopCurrentMotion();
        }

        // 2. ボーンの状態を初期ポーズにリセット
        if (vrmViewerRef.current?.resetVrmPose) {
          vrmViewerRef.current.resetVrmPose();
        }

        // 3. 短時間待機してからフェードイン
        await new Promise(resolve => setTimeout(resolve, 200));

        // 4. idle_sway_alt をフェードインで再生
        await motionControls.playMotion('idle_sway_alt');
      } catch (error) {
        console.warn('[Interaction] Failed to play idle_sway_alt motion:', error);
      }
    }

    try {
      // キャラクターを思考中の表情に（短時間）
      setCurrentEmotion('thinking');

      console.log('[Interaction] Sending prompt to AI:', prompt);

      let assistantMessage = '';
      // Replicate を使ってインタラクションの応答を生成（履歴付き）
      // 全履歴を送信（コストはほぼ変わらず、連続性が向上）
      assistantMessage = await replicateService.chat(prompt, {
        systemPrompt: systemPrompt,
        temperature: 0.9,
        maxTokens: 150,
        conversationHistory: interactionHistory
      });

      console.log('[Interaction] AI response:', assistantMessage);

      // GPT-5 nano表情生成を先に開始（TTS合成前）
      setCurrentSpeechText(assistantMessage);

      // 履歴に追加（最大3往復まで保持）
      setInteractionHistory(prev => {
        const newHistory = [
          ...prev,
          { role: 'user', content: prompt },
          { role: 'assistant', content: assistantMessage }
        ];
        // 最新6メッセージのみ保持（3往復分）
        return newHistory.slice(-6);
      });

      // 感情分析：まずテキストから感情キーワードを検出
      let detectedEmotion = detectEmotionFromText(assistantMessage);

      // 検出失敗した場合、部位に応じたフォールバック表情を使用
      if (!detectedEmotion && bodyPartForFallback) {
        console.log('[Interaction] Emotion detection failed, using bodyPart fallback:', bodyPartForFallback);

        // 部位ごとのフォールバック表情（ランダム）
        const fallbackEmotions = {
          skirt: ['happy', 'angry', 'surprised'], // 恥ずかしい/怒り/驚き
          hair: ['angry', 'surprised'], // 怒り/驚き
          accessory: ['surprised', 'thinking'], // 驚き/困惑
          intimate: ['happy', 'angry', 'surprised'], // 恥ずかしい/怒り/驚き
          head: ['happy'], // 照れ笑顔
          shoulder: ['neutral'], // 普通
          arm: ['happy', 'surprised'], // 嬉しい/驚き
          leg: ['surprised', 'thinking'], // 不思議/困惑
          default: ['neutral']
        };

        const emotions = fallbackEmotions[bodyPartForFallback] || fallbackEmotions.default;
        detectedEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        console.log('[Interaction] Fallback emotion selected:', detectedEmotion);
      }

      // 最終的な感情（検出成功 or フォールバック or aiService分析）
      const finalEmotion = detectedEmotion || aiService.analyzeEmotion(assistantMessage);
      setCurrentEmotion(finalEmotion);

      await applyEmotionAndMotion(assistantMessage, finalEmotion);

      // 音声合成（設定で有効な場合のみ）
      if (!enableInteractionVoice) {
        console.log('[Interaction] Voice disabled by settings');
        return;
      }

      console.log('[Interaction] Starting TTS with engine:', ttsEngine, 'character:', voiceCharacter, 'message:', assistantMessage);

      try {
        if (ttsEngine === 'voicevox' || ttsEngine.startsWith('mod:')) {
          // VOICEVOX TTS または TTS Mod
          setIsSpeaking(true);
          setIsTTSSpeaking(true);
          setCurrentSpeechText(assistantMessage);
          setCurrentGesture('speaking');

          await synthesizeSpeech(assistantMessage);

          setIsSpeaking(false);
          setIsTTSSpeaking(false);
        } else if (ttsEngine === 'rvc-tts') {
          // RVC TTS (StyleBertVITS2 + RVC変換)
          setIsSpeaking(true);
          setIsTTSSpeaking(true);
          setCurrentSpeechText(assistantMessage);
          setCurrentGesture('speaking');

          await rvcTTSService.speak(assistantMessage, {
            character: voiceCharacter,
            speedScale: voiceSpeedScale,
            volumeScale: 1.0
          });

          setIsSpeaking(false);
          setIsTTSSpeaking(false);
          setCurrentSpeechText('');
          setCurrentGesture(null);
        }
        // else if (ttsEngine.startsWith('moe-model')) {
        //   // GPT-5 nano表情生成を先に開始（TTS合成前）
        //   setCurrentSpeechText(assistantMessage);

        //   const modelId = ttsEngine === 'moe-model12' ? 12 : 15;
        //   await moeTTSService.speak(assistantMessage, {
        //     modelId: modelId,
        //     speaker: voiceCharacter,
        //     speed: 1.0,
        //     language: ttsLanguage,
        //     onSynthesisStart: () => {
        //       setIsPreparingVoice(true);
        //       setCurrentEmotion('thinking');
        //       setCurrentGesture('thinking');
        //     },
        //     onPlaybackStart: () => {
        //       console.log('[Conversation] onPlaybackStart - setting isSpeaking=true');
        //       setIsPreparingVoice(false);
        //       setIsSpeaking(true);
        //       setIsTTSSpeaking(true);
        //       setCurrentEmotion(finalEmotion);
        //       setCurrentGesture('speaking');
        //     },
        //     onPlaybackEnd: () => {
        //       console.log('[Conversation] onPlaybackEnd - setting isSpeaking=false');
        //       setIsSpeaking(false);
        //       setIsTTSSpeaking(false);
        //       setCurrentSpeechText(''); // 発話テキストをクリア
        //       setCurrentGesture(null);
        //     }
        //   });
        // }
        else if (false && ttsEngine === 'vits-uma') { // コメントアウト
          const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
          const characterId = character ? character.id : 0;

          await umaVoiceService.speak(assistantMessage, {
            characterId: characterId,
            language: 'Japanese',
            speed: 1.0,
            onSynthesisStart: () => {
              setIsPreparingVoice(true);
              setCurrentEmotion('thinking');
              setCurrentGesture('thinking');
            },
            onPlaybackStart: () => {
              setIsPreparingVoice(false);
              setIsSpeaking(true);
              setIsTTSSpeaking(true);
              setCurrentEmotion(finalEmotion);
              setCurrentGesture('speaking');
            },
            onPlaybackEnd: () => {
              setIsSpeaking(false);
              setIsTTSSpeaking(false);
              setCurrentSpeechText(''); // 発話テキストをクリア
              setCurrentGesture(null);
              console.log('[Interaction] TTS playback ended');
            }
          });
        }
      } catch (error) {
        console.error('Voice synthesis error:', error);
      } finally {
        setIsSpeaking(false);
        setIsPreparingVoice(false);
        setCurrentGesture(null);
      }
    } catch (error) {
      console.error('Interaction handler error:', error);

      // トークン上限エラーの場合、音声認識を停止
      const isTokenLimitError = error.message?.includes('Token limit exceeded');
      if (isTokenLimitError) {
        console.log('[Interaction] Token limit exceeded - stopping voice recording');
        if (voiceRecorder) {
          voiceRecorder.stopRecording();
        }
        setAiStatus('error');
        aiStatusRef.current = 'error';
      }
    }
  };

  // 自動話しかけ機能
  useEffect(() => {
    if (!enableAutoTalk || aiStatus !== 'ready') return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const elapsedSinceInteraction = now - lastInteractionTimeRef.current;
      const elapsedSinceAutoTalk = now - lastAutoTalkTimeRef.current;

      // 2分（120秒 = 120000ms）経過したら話しかける（ただし最後の自動話しかけから2分以上経過している必要がある）
      if (elapsedSinceInteraction > 120000 && elapsedSinceAutoTalk > 120000 && !isSpeaking && !isTyping && !isTTSSpeaking) {
        console.log('[AutoTalk] User inactive for 2 minutes, talking...');
        lastAutoTalkTimeRef.current = now;

        try {
          setIsAutoTalking(true); // 自動話しかけ開始
          // 思考中の表情
          setCurrentEmotion('thinking');

          // Replicate APIを使用（インタラクションと同じ）
          const assistantMessage = await replicateService.chat(autoTalkPrompt, {
            systemPrompt: '',
            temperature: 1.5,
            maxTokens: 50  // 自動話しかけは少し長めに
          });

          console.log('[AutoTalk] Assistant response:', assistantMessage);

          // 空の応答をスキップ
          if (!assistantMessage || !assistantMessage.trim()) {
            console.log('[AutoTalk] Empty response, skipping...');
            setIsAutoTalking(false);
            return;
          }

          // 感情分析
          const fallbackEmotion = aiService.analyzeEmotion(assistantMessage);
          setCurrentEmotion(fallbackEmotion);

          // GPT-5 nano表情生成を先に開始（TTS合成前）
          setCurrentSpeechText(assistantMessage);

          // 音声再生
          // if (ttsEngine.startsWith('moe-model')) {
          //   const modelId = ttsEngine === 'moe-model12' ? 12 : 15;
          //   await moeTTSService.speak(assistantMessage, {
          //     modelId: modelId,
          //     speaker: voiceCharacter,
          //     speed: 1.0,
          //     language: ttsLanguage,
          //     onSynthesisStart: () => {
          //       setIsPreparingVoice(true);
          //       setCurrentEmotion('thinking');
          //       setCurrentGesture('thinking');
          //     },
          //     onPlaybackStart: () => {
          //       setIsPreparingVoice(false);
          //       setIsTTSSpeaking(true);
          //     },
          //     onPlaybackEnd: () => {
          //       setIsTTSSpeaking(false);
          //       setCurrentSpeechText(''); // 発話テキストをクリア
          //       setCurrentEmotion(fallbackEmotion);
          //       setCurrentGesture(null);
          //       setIsAutoTalking(false); // 自動話しかけ終了
          //     }
          //   });
          // } else
          if (ttsEngine === 'vits-uma') {
            const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
            const characterId = character ? character.id : 0;

            await umaVoiceService.speak(assistantMessage, {
              characterId: characterId,
              language: 'Japanese',
              speed: 1.0,
              onSynthesisStart: () => {
                setIsPreparingVoice(true);
                setCurrentEmotion('thinking');
                setCurrentGesture('thinking');
              },
              onPlaybackStart: () => {
                setIsPreparingVoice(false);
                setIsTTSSpeaking(true);
              },
              onPlaybackEnd: () => {
                setIsTTSSpeaking(false);
                setCurrentSpeechText(''); // 発話テキストをクリア
                setCurrentEmotion(fallbackEmotion);
                setCurrentGesture(null);
                setIsAutoTalking(false); // 自動話しかけ終了
              }
            });
          }

          // 次回の話しかけまで時間をリセット（ただしlastInteractionTimeRefはリセットしない - これはユーザーアクションではないため）
        } catch (error) {
          console.error('[AutoTalk] Error:', error);
          // エラー時に状態をリセット
          setIsPreparingVoice(false);
          setIsTTSSpeaking(false);
          setCurrentGesture(null);
          setIsAutoTalking(false); // 自動話しかけ終了
        }
      }
    }, 30000); // 30秒ごとにチェック

    return () => clearInterval(interval);
  }, [enableAutoTalk, aiStatus]);

  const handleVoiceRecord = async () => {
    if (isRecording) {
      // 録音停止
      voiceRecorder.stopRecording();
      setIsRecording(false);
    } else {
      // AIが準備できていない場合
      if (aiStatus !== 'ready') {
        alert('AIを初期化してください');
        return;
      }

      // 録音開始
      try {
        await voiceRecorder.startRecording(
          (transcript) => {
            // 認識結果を受け取ったら自動的に送信
            setMessage(transcript);
            setIsRecording(false);
            // メッセージを設定した後、すぐに送信
            setTimeout(() => {
              if (transcript.trim()) {
                handleSendMessage();
              }
            }, 100);
          },
          (error) => {
            console.error('音声認識エラー:', error);
            alert('音声認識に失敗しました: ' + error);
            setIsRecording(false);
          }
        );
        setIsRecording(true);
      } catch (error) {
        console.error('録音開始エラー:', error);
        alert('音声認識を開始できませんでした: ' + error.message);
      }
    }
  };

  // 連続会話モードのトグル
  const toggleConversationMode = async () => {
    if (isConversationMode) {
      // 会話モード終了
      isConversationModeRef.current = false;
              setIsConversationMode(false);
      conversationModeRef.current = false;
      setIsRecording(false);

      // 会話タイマーをクリア
      if (conversationTimer) {
        clearTimeout(conversationTimer);
        setConversationTimer(null);
      }

      console.log('[Conversation] Mode ended (VAD continues running)');
    } else {
      // 会話モード開始
      if (aiStatus !== 'ready') {
        alert('AIを初期化してください');
        return;
      }
      isConversationModeRef.current = true; // 即座にrefを更新
      setIsConversationMode(true);
      conversationModeRef.current = true;

      // 20分タイマー開始
      if (conversationTimer) clearTimeout(conversationTimer);
      const timer = setTimeout(() => {
        setShowConversationConfirm(true);
      }, 20 * 60 * 1000); // 20分
      setConversationTimer(timer);

      console.log('[Conversation] Mode started');
    }
  };

  // 音声登録のハンドラー
  const recordVoiceForPrint = async () => {
    try {
      setIsVoiceRecordingForPrint(true);
      console.log('[VoicePrint] Starting 5-second recording...');

      // マイクアクセス
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // ストリームを停止
        stream.getTracks().forEach(track => track.stop());

        try {
          // BlobをAudioBufferに変換
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // 声紋を登録
          const success = voicePrintService.registerVoicePrint(audioBuffer, 16000);

          if (success) {
            setVoicePrintCount(voicePrintService.getRegisteredCount());

            // 次のステップへ
            if (voiceRegistrationStep < 3) {
              setVoiceRegistrationStep(voiceRegistrationStep + 1);
            } else {
              // 完了
              setShowVoiceRegistration(false);
              setVoiceRegistrationStep(0);
              alert('音声登録が完了しました！');
            }
          } else {
            alert('音声登録に失敗しました。もう一度お試しください。');
          }

          await audioContext.close();
        } catch (error) {
          console.error('[VoicePrint] Registration error:', error);
          alert('音声登録エラー: ' + error.message);
        }

        setIsVoiceRecordingForPrint(false);
      };

      mediaRecorder.start();

      // 5秒後に停止
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);

    } catch (error) {
      console.error('[VoicePrint] Recording error:', error);
      alert('マイクへのアクセスが拒否されました: ' + error.message);
      setIsVoiceRecordingForPrint(false);
    }
  };

  // 連続会話モード用のリスニング開始
  const startConversationListening = async () => {
    console.log('[Conversation] startConversationListening called - conversationMode:', conversationModeRef.current);

    if (!conversationModeRef.current) {
      console.log('[Conversation] Not in conversation mode, skipping');
      return;
    }

    try {
      console.log('[Conversation] Starting VAD with wake word detection...');
      await voiceRecorder.startRecordingWithVADv2(
        // Whisper APIの結果（連続会話モード中のみ呼ばれる）
        (transcript) => {
          console.log('[Whisper] Transcript received:', transcript);

          // 終了ワード判定（Whisper結果で判定）
          if (speechRecognition.detectEndWord(transcript, endWords)) {
            console.log('[End Word] Detected! Ending conversation mode...');
            isConversationModeRef.current = false;
              setIsConversationMode(false);
            if (conversationTimer) {
              clearTimeout(conversationTimer);
              setConversationTimer(null);
            }
            return;
          }

          // 通常のチャット送信
          if (transcript.trim()) {
            handleSendMessage(true, transcript);
          }
        },
        // エラーハンドラ
        (error) => {
          console.error('連続会話モードエラー:', error);
        },
        // オプション
        {
          // Web Speech APIの結果（ウェイクワード判定のみ）
          onSpeechRecognition: (transcript) => {
            console.log('[Web Speech] Transcript:', transcript);

            // ウェイクワード判定のみ（最新の設定を参照）
            if (!isConversationModeRef.current && speechRecognition.detectWakeWord(transcript, wakeWordsRef.current)) {
              console.log('[Wake Word] Detected! Starting conversation mode...');
              isConversationModeRef.current = true; // 即座にrefを更新
              setIsConversationMode(true);

              // ランダムな返事をTTSで再生
              if (wakeWordResponses.length > 0) {
                const randomResponse = wakeWordResponses[Math.floor(Math.random() * wakeWordResponses.length)];
                console.log('[Wake Word] Responding with:', randomResponse);

                // TTS設定に応じて再生
                // if (ttsEngine.startsWith('moe-model')) {
                //   const modelId = ttsEngine === 'moe-model12' ? 12 : 15;
                //   moeTTSService.speak(randomResponse, {
                //     modelId: modelId,
                //     speaker: voiceCharacter,
                //     speed: 1.0,
                //     language: ttsLanguage
                //   });
                // } else
                if (ttsEngine === 'vits-uma') {
                  const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
                  const characterId = character ? character.id : 0;
                  umaVoiceService.speak(randomResponse, {
                    characterId: characterId,
                    language: 'Japanese',
                    speed: 1.0
                  });
                }
              }

              // 20分タイマー開始
              if (conversationTimer) clearTimeout(conversationTimer);
              const timer = setTimeout(() => {
                setShowConversationConfirm(true);
              }, 20 * 60 * 1000); // 20分
              setConversationTimer(timer);
            }
          },
          // 連続会話モード判定関数
          isConversationMode: () => isConversationModeRef.current
        }
      );
      console.log('[Conversation] VAD started successfully');
    } catch (error) {
      console.error('連続会話モードVAD開始エラー:', error);
    }
  };

  // タイマー通知ハンドラー（ユーザーが応答するまで繰り返し話しかける）
  const handleTimerComplete = async (message) => {
    console.log('[Timer Complete] Notifying user:', message);

    // 既存の繰り返しがあればキャンセル
    if (timerReminderInterval) {
      clearInterval(timerReminderInterval);
      setTimerReminderInterval(null);
    }

    // 通知メッセージを作成
    const notificationMessage = `⏰ タイマーが終了しました！${message}`;

    // キャラクターに話しかけさせる関数
    const speakReminder = async () => {
      if (isSpeaking || isTyping || isTTSSpeaking) {
        console.log('[Timer] Character is busy, waiting...');
        return;
      }

      try {
        setCurrentEmotion('happy');
        setCurrentGesture('wave');

        // TTSで通知
        await synthesizeSpeech(assistantMessage);

        if (false && ttsEngine === 'vits-uma') { // コメントアウト
          const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
          const characterId = character ? character.id : 0;
          await umaVoiceService.speak(notificationMessage, {
            characterId: characterId,
            language: 'Japanese',
            speed: 1.0
          });
        }

        setCurrentGesture(null);
      } catch (error) {
        console.error('[Timer] Speak error:', error);
      }
    };

    // 最初の通知
    await speakReminder();

    // 30秒ごとに繰り返し（ユーザーが応答するまで）
    const interval = setInterval(speakReminder, 30000);
    setTimerReminderInterval(interval);
  };

  // ユーザーが何か操作したら繰り返し通知を停止
  useEffect(() => {
    if (timerReminderInterval && (isSpeaking || isTyping)) {
      console.log('[Timer] User is interacting, stopping reminders');
      clearInterval(timerReminderInterval);
      setTimerReminderInterval(null);
    }
  }, [isSpeaking, isTyping, timerReminderInterval]);

  // 画面キャプチャハンドラ（画像のみキャプチャ、送信はしない）
  const handleScreenCapture = async () => {
    if (isCapturing) return null;

    try {
      setIsCapturing(true);
      console.log('[Screen Capture] Capturing screen...');

      // Electron APIを呼び出し
      const result = await window.electronAPI.captureScreen();

      if (result.error) {
        console.error('[Screen Capture] Error:', result.error);
        setChatHistory(prev => [...prev, {
          role: 'system',
          content: `❌ ${result.error}`
        }]);
        return null;
      }

      // キャプチャ成功
      console.log('[Screen Capture] Captured successfully');
      setCapturedImage(result.image);
      return result.image;

    } catch (error) {
      console.error('[Screen Capture] Error:', error);
      setChatHistory(prev => [...prev, {
        role: 'system',
        content: `❌ キャプチャエラー: ${error.message}`
      }]);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSendMessage = async (isFromConversationMode = false, directMessage = null, imageBase64 = null) => {
    const messageToSend = directMessage || message;
    if (!messageToSend.trim()) return;

    // 画像の優先順位: 1. 引数で渡された画像, 2. キャプチャ済み画像, 3. キーワード検出で自動キャプチャ
    let imageToSend = imageBase64 || capturedImage;

    // 「画面」「スクショ」などのキーワードを検出して自動キャプチャ（画像がまだない場合のみ）
    if (!imageToSend) {
      const screenKeywords = ['画面', 'スクショ', 'スクリーンショット', '見て', 'この'];
      const hasScreenKeyword = screenKeywords.some(keyword => messageToSend.includes(keyword));

      if (hasScreenKeyword && !isCapturing) {
        console.log('[Auto Capture] Screen keyword detected:', messageToSend);
        // スクショを撮って、ユーザーのメッセージと一緒に送信
        imageToSend = await handleScreenCapture();
        if (!imageToSend) {
          // キャプチャ失敗時は処理を中断
          return;
        }
      }
    }

    // ユーザーインタラクション時刻を更新
    lastInteractionTimeRef.current = Date.now();

    // AIが準備できていない場合
    if (aiStatusRef.current !== 'ready') {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'AIを初期化してください'
      }]);
      return;
    }

    // チャット履歴に追加（画像がある場合は📸アイコンを付ける）
    const userMessage = messageToSend;
    const displayMessage = imageToSend ? `📸 ${userMessage}` : userMessage;
    setChatHistory(prev => [...prev, { role: 'user', content: displayMessage }]);
    setMessage('');
    setIsTyping(true);

    // 挨拶を検出して手を振る
    if (aiService.detectGreeting(userMessage)) {
      setCurrentGesture('wave');
      setTimeout(() => setCurrentGesture(null), 100); // ジェスチャーをリセット
    }

    try {
      // キャラクターを思考中の表情に
      setCurrentEmotion('thinking');

      let assistantMessage = '';

      // 画像がある場合は画像付きチャット（Function Callingなし）
      if (imageToSend) {
        console.log('[Chat] Sending message with image:', userMessage);
        try {
          assistantMessage = await aiService.chatWithImage(
            userMessage,
            imageToSend,
            (chunk, fullText) => {
              // リアルタイムでチャット履歴を更新
              setChatHistory(prev => {
                const newHistory = [...prev];
                const lastIndex = newHistory.length - 1;
                if (newHistory[lastIndex]?.role === 'assistant') {
                  newHistory[lastIndex].content = fullText;
                } else {
                  newHistory.push({ role: 'assistant', content: fullText });
                }
                return newHistory;
              });
            }
          );
          console.log('[Chat] Image chat completed:', assistantMessage);

          // TTS用の発音変換
          try {
            const ttsMessage = await aiService.chat(
              `以下のテキストを、日本語TTSで正しく発音できるように変換してください。英語の略語、固有名詞、数字はすべてカタカナまたはひらがなに変換してください。元の意味を変えずに、発音しやすい形に変換してください。

変換ルール:
- 英語の略語・固有名詞はカタカナに変換
- 数字や記号も読みやすく変換
- 漢字はそのまま（ひらがなにしない）

例:
- Mercedes AMG → メルセデス・えーえむじー
- AI → えーあい
- CPU → しーぴーゆー
- 100% → ひゃくパーセント
- iPhone → あいふぉーん

テキスト:
${assistantMessage}`,
              null,
              { saveToHistory: false, systemPrompt: 'あなたはテキスト変換アシスタントです。指示に従ってテキストを変換してください。' }
            );
            if (ttsMessage && ttsMessage.trim()) {
              assistantMessage = ttsMessage;
            }
          } catch (ttsError) {
            console.error('[TTS] Pronunciation conversion failed:', ttsError);
            // エラー時は元のメッセージを使用
          }
        } catch (error) {
          console.error('[Chat] Image chat error:', error);
          throw error;
        }

        // キャプチャ画像をクリア
        setCapturedImage(null);
      }
      // 画像がない場合はFunction Calling対応のチャット
      else {
      const response = await aiService.chatWithTools(userMessage, toolDefinitions);

      let hasWebSearch = false;

      // Web検索結果を検出（複数パターン）
      if (response.response && response.response.output) {
        const webSearchResults = response.response.output.filter(item =>
          item.type === 'web_search_result' ||
          (item.type === 'message' && item.content && item.content.some(c => c.type === 'web_search_result'))
        );
        if (webSearchResults.length > 0) {
          hasWebSearch = true;
          console.log('[Web Search] Detected web search results via output');
        }
      }

      // contentの内容でも検出（天気情報、ニュース、検索結果などのパターン）
      if (!hasWebSearch && response.content && typeof response.content === 'string') {
        const searchPatterns = [
          /時間予測:|現在の状態:|悪天候アラート:/,  // 天気情報
          /##\s*〒.*の天候:/,  // 天気の見出し
          /発表者:\s*気象庁/,  // 気象庁アラート
          /\d+°[FC]\s*\(\d+°[FC]\)/,  // 温度表記（75°F (24°C)）
          /にわか雨|時々曇り|所により晴れ|快晴/,  // 天気の状態
          /午前\d+:\d+\s*\(JST\)/,  // 時刻表記
          /ソース:|情報源:|出典:/,  // 検索結果のソース表記
          /https?:\/\//  // URL（検索結果に含まれる）
        ];

        if (searchPatterns.some(pattern => pattern.test(response.content))) {
          hasWebSearch = true;
          console.log('[Web Search] Detected web search results via content pattern');
        }
      }

      // ツール呼び出しがある場合
      if (response.type === 'tool_calls') {
        console.log('[Tool Calls] Detected:', response.tool_calls);

        // 各ツールを実行
        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[Tool Execute] ${toolName}`, toolArgs);

          try {
            // ツールを実行
            const toolResult = await toolExecutor.execute(toolName, toolArgs);

            // ツール実行結果をチャット履歴に表示
            setChatHistory(prev => [...prev, {
              role: 'system',
              content: `🔧 ${toolName}: ${toolResult}`
            }]);

            // set_timerの場合はAIに結果を返さない（タイマー完了時にhandleTimerCompleteが呼ばれる）
            if (toolName === 'set_timer') {
              // タイマー設定完了のメッセージのみ表示
              assistantMessage = toolResult;
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: assistantMessage
              }]);
            } else {
              // その他のツールは結果をAIに返して最終レスポンスを取得
              assistantMessage = await aiService.continueWithToolResult(
                toolCall.id,
                toolName,
                toolResult,
                (chunk, fullText) => {
                  // リアルタイムでチャット履歴を更新
                  setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastIndex = newHistory.length - 1;
                    if (newHistory[lastIndex]?.role === 'assistant') {
                      newHistory[lastIndex].content = fullText;
                    } else {
                      newHistory.push({ role: 'assistant', content: fullText });
                    }
                    return newHistory;
                  });
                }
              );
            }
          } catch (toolError) {
            console.error(`[Tool Error] ${toolName}:`, toolError);
            setChatHistory(prev => [...prev, {
              role: 'system',
              content: `❌ ツール実行エラー: ${toolError.message}`
            }]);
          }
        }
      } else {
        // 通常のテキスト応答
        console.log('[App] response object:', response);
        console.log('[App] response.content:', response.content);
        assistantMessage = response.content;

        // Web検索結果がある場合、口調変換とTTS変換を実行（チャット履歴追加前）
        if (hasWebSearch && assistantMessage) {
          console.log('[Web Search] Summarizing and converting to character tone...');
          try {
            const convertedMessage = await aiService.chat(
              `以下のWeb検索結果を、キャラクタープロンプトで指定された口調・性格で自然に要約してください。

【キャラクタープロンプト】
${systemPrompt}

【重要な制約】
- 音声読み上げ用なので、自然な会話調で伝える
- 重要な情報は省略せず含める（気温、時間帯、注意事項など）
- 天気の場合: 現在の天気、気温、今後の変化、注意報があれば伝える
  例: 「今日の横浜は曇りで24度くらいだよ。午後からは晴れてくるみたい。夜は19度まで下がるから、羽織るものがあると安心かも。あと、強風注意報が出てるから気をつけてね」
- ニュースの場合: 内容の要点をしっかり伝える
  例: 「〇〇が△△したんだって。理由は□□らしいよ。これによって××な影響があるみたい」
- リスト・箇条書き・マークダウン記号は使わない
- URL、ソース名（[example.com]など）は完全に省略
- キャラクター設定の口調・性格を必ず反映させる
- 3〜5文程度で、詳細を含めつつ自然に話す

【Web検索結果】
${assistantMessage}`,
              null,
              { saveToHistory: false, systemPrompt: systemPrompt }
            );
            assistantMessage = convertedMessage;

            // TTS用の発音変換
            try {
              const ttsMessage = await aiService.chat(
                `以下のテキストを、日本語TTSで正しく発音できるように変換してください。

【変換ルール】
1. 英語の略語・固有名詞のみカタカナに変換
2. 日本語の漢字・ひらがな・カタカナは絶対に変更しない
3. URL（[example.com]など）は完全に削除
4. 記号・数字は読みやすい形に変換

【変換例】
- AI → えーあい
- CPU → しーぴーゆー
- iPhone → あいふぉーん
- 100% → ひゃくパーセント
- [example.com] → （削除）

【変換してはいけない例】
- 日本 → そのまま「日本」
- 会社 → そのまま「会社」
- 政府 → そのまま「政府」
- バイデン大統領 → そのまま「バイデン大統領」

テキスト:
${assistantMessage}`,
                null,
                { saveToHistory: false, systemPrompt: 'あなたはテキスト変換アシスタントです。日本語の漢字は絶対に変更せず、英語の略語だけをカタカナに変換してください。' }
              );
              if (ttsMessage && ttsMessage.trim()) {
                assistantMessage = ttsMessage;
              }
            } catch (ttsError) {
              console.error('[TTS] Pronunciation conversion failed:', ttsError);
              // エラー時は口調変換後のメッセージを使用
            }
          } catch (error) {
            console.error('[Web Search] Tone conversion failed:', error);
            // エラー時は元のメッセージを使用
          }
        }

        // チャット履歴に追加（Web検索の場合は変換後のメッセージを追加）
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: assistantMessage
        }]);
      }
      } // else (画像がない場合のFunction Calling処理)終了

      // 感情分析（共通処理）
      const fallbackEmotion = aiService.analyzeEmotion(assistantMessage);
      setCurrentEmotion(fallbackEmotion);

      // GPT-5 nano表情生成を先に開始（TTS合成前）
      setCurrentSpeechText(assistantMessage);

      // 相槌を再生（AI応答前の待ち時間短縮）
      if (fillerPhrases.length > 0) {
        const randomFiller = fillerPhrases[Math.floor(Math.random() * fillerPhrases.length)];
        console.log('[Filler] Playing:', randomFiller);

        // 相槌をTTSで再生（完了を待たずに次に進む）
        synthesizeSpeech(randomFiller).catch(error => {
          console.error('[Filler] TTS failed:', error);
        });

        if (false && ttsEngine === 'vits-uma') { // コメントアウト
          const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
          const characterId = character ? character.id : 0;
          umaVoiceService.speak(randomFiller, {
            characterId: characterId,
            emotion: 'normal',
            speed: 1.0
          });
        }

        // 相槌再生中に少し待つ（200ms程度）
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // MMDモデルの場合は発声時専用モーションを使用
      if (modelType === 'mmd') {
        console.log('[TTS] Setting MMD to speaking motion');

        // 発声時用モーション（「ぼんやり待ちループ」または「会話モーション_頭かく」）をランダムに選択
        const speakingMotions = ['ぼんやり待ちループ.zip', '会話モーション_頭かく.zip'];
        const selectedMotion = speakingMotions[Math.floor(Math.random() * speakingMotions.length)];

        try {
          const response = await fetch(`./モーション/${selectedMotion}`);
          if (response.ok) {
            const blob = await response.blob();
            const zipFile = new File([blob], selectedMotion, { type: 'application/zip' });
            const extracted = await extractMmdZip(zipFile);

            if (extracted && extracted.resources.animations.length > 0) {
              const speakingMotionUrl = extracted.resources.animations[0].url;
              console.log('[TTS] Loaded speaking motion from zip:', selectedMotion, speakingMotionUrl);
              setMmdActiveMotionUrl(speakingMotionUrl);
            } else {
              console.log('[TTS] No animation in speaking motion zip, using first variant');
              if (mmdVariantMotionUrls.length > 0) {
                setMmdActiveMotionUrl(mmdVariantMotionUrls[0]);
              }
            }
          } else {
            console.log('[TTS] Could not fetch speaking motion, using first variant');
            if (mmdVariantMotionUrls.length > 0) {
              setMmdActiveMotionUrl(mmdVariantMotionUrls[0]);
            }
          }
        } catch (error) {
          console.error('[TTS] Failed to load speaking motion:', error);
          if (mmdVariantMotionUrls.length > 0) {
            setMmdActiveMotionUrl(mmdVariantMotionUrls[0]);
          }
        }
      } else {
        await applyEmotionAndMotion(assistantMessage, fallbackEmotion);
      }

      // テキストを適切な長さに分割（句点で分割し、最大150文字ごとに）
      const splitTextForTTS = (text) => {
        // URLを除去（http:// や https:// を含む文字列を削除）
        let cleanedText = text.replace(/https?:\/\/[^\s　]+/g, '');

        // 小数点を含む数値を正しく読めるように変換（例: 8.1 → 8点1）
        cleanedText = cleanedText.replace(/(\d+)\.(\d+)/g, '$1点$2');

        // パーセント記号を「パーセント」に変換
        cleanedText = cleanedText.replace(/(\d+)%/g, '$1パーセント');

        const sentences = cleanedText.split(/([。！？\n])/);
        const chunks = [];
        let currentChunk = '';

        for (let i = 0; i < sentences.length; i++) {
          const segment = sentences[i];
          if (currentChunk.length + segment.length > 150 && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = segment;
          } else {
            currentChunk += segment;
          }
        }

        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }

        return chunks.filter(c => c.trim().length > 0);
      };

      // 音声合成（長文の場合は分割して並列合成→順次再生）
      try {
        const textChunks = splitTextForTTS(assistantMessage);
        console.log(`[TTS] Split text into ${textChunks.length} chunks`);

        // if (ttsEngine.startsWith('moe-model')) {
        //   // Moe TTSを使用
        //   const modelId = ttsEngine === 'moe-model12' ? 12 : 15;

        //   // 音声合成準備開始
        //   setIsPreparingVoice(true);
        //   setCurrentEmotion('thinking');
        //   setCurrentGesture('thinking');

        //   // 音声合成を並列開始（Promiseの配列）
        //   console.log('[TTS] Starting synthesis for all chunks in parallel...');
        //   const synthesisPromises = textChunks.map(chunk =>
        //     moeTTSService.synthesize(chunk, {
        //       modelId: modelId,
        //       speaker: voiceCharacter,
        //       speed: 1.0,
        //       language: ttsLanguage
        //     })
        //   );

        //   // 最初のチャンクの合成完了を待って即座に再生開始
        //   const firstAudioUrl = await synthesisPromises[0];
        //   setIsPreparingVoice(false);
        //   setIsSpeaking(true);
        //   setIsTTSSpeaking(true);
        //   setCurrentEmotion(fallbackEmotion);
        //   setCurrentGesture('speaking');

        //   console.log(`[TTS] Playing chunk 1/${textChunks.length}`);
        //   await moeTTSService.playAudio(firstAudioUrl);

        //   // 残りのチャンクを順次再生（合成完了次第）
        //   for (let i = 1; i < synthesisPromises.length; i++) {
        //     const audioUrl = await synthesisPromises[i];
        //     console.log(`[TTS] Playing chunk ${i + 1}/${textChunks.length}`);
        //     await moeTTSService.playAudio(audioUrl);
        //   }

        // } else
        if (ttsEngine === 'voicevox' || ttsEngine.startsWith('mod:')) {
          // VOICEVOX または TTS Mod
          setIsSpeaking(true);
          setIsTTSSpeaking(true);
          setCurrentEmotion(fallbackEmotion);
          setCurrentGesture('speaking');

          // チャンクを順次再生
          for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            console.log(`[TTS] Playing chunk ${i + 1}/${textChunks.length}`);
            await synthesizeSpeech(chunk);
          }

        } else if (ttsEngine === 'vits-uma') {
          // VITS-Umamusumeの場合は従来通り（synthesizeメソッドがないため）
          for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            const isFirst = i === 0;

            const character = umaVoiceService.constructor.getCharacterByJpName(voiceCharacter);
            const characterId = character ? character.id : 0;

            await umaVoiceService.speak(chunk, {
              characterId: characterId,
              language: 'Japanese',
              speed: 1.0,
              onSynthesisStart: () => {
                if (isFirst) {
                  setIsPreparingVoice(true);
                  setCurrentEmotion('thinking');
                  setCurrentGesture('thinking');
                }
              },
              onPlaybackStart: () => {
                if (isFirst) {
                  setIsPreparingVoice(false);
                  setIsSpeaking(true);
                  setIsTTSSpeaking(true);
                  setCurrentEmotion(fallbackEmotion);
                  setCurrentGesture('speaking');
                }
              }
            });
          }
        }
      } catch (error) {
        console.error('Voice synthesis error:', error);
      } finally {
        setIsSpeaking(false);
        setIsPreparingVoice(false);
        setIsTTSSpeaking(false);
        setCurrentSpeechText(''); // 発話テキストをクリア
        setCurrentGesture(null);

        // VADは常に動き続けるので、再起動は不要
        console.log('[Conversation] TTS completed - VAD continues listening');
      }

    } catch (error) {
      console.error('[Chat] Error:', error);

      // トークン上限エラーの場合、音声認識を停止
      const isTokenLimitError = error.message?.includes('Token limit exceeded');
      if (isTokenLimitError) {
        console.log('[Chat] Token limit exceeded - stopping voice recording');
        if (voiceRecorder) {
          voiceRecorder.stopRecording();
        }
        setAiStatus('error');
        aiStatusRef.current = 'error';
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: '今月のトークン上限に達しました。音声認識を停止しました。'
        }]);
        return;
      }

      // 接続エラーの可能性がある場合、自動再接続を試みる
      const isConnectionError =
        error.message?.includes('fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('Failed to fetch') ||
        error.status === 503 ||
        error.status === 429;

      if (isConnectionError && aiStatusRef.current === 'ready') {
        console.log('[Chat] Connection error detected, attempting auto-reconnect...');
        setAiStatus('reconnecting');
        aiStatusRef.current = 'reconnecting';

        // 3秒待ってから再接続を試みる
        setTimeout(async () => {
          try {
            console.log('[Chat] Retrying AI initialization...');
            await initializeAI();
            console.log('[Chat] Auto-reconnect successful');

            // 再接続成功後、元のメッセージを再送信
            if (messageToSend.trim()) {
              setTimeout(() => {
                handleSendMessage(isFromConversationMode, messageToSend, imageBase64);
              }, 1000);
            }
          } catch (reconnectError) {
            console.error('[Chat] Auto-reconnect failed:', reconnectError);
            setAiStatus('error');
            aiStatusRef.current = 'error';
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: 'AI接続に失敗しました。設定から再接続してください。'
            }]);
          }
        }, 3000);
      } else {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: 'エラーが発生しました。もう一度お試しください。'
        }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const [showModelTypeDialog, setShowModelTypeDialog] = useState(false);
  const [pendingModelUrl, setPendingModelUrl] = useState(null);
  const [pendingModelName, setPendingModelName] = useState(null);
  const [suggestedType, setSuggestedType] = useState('vrm');
  const [pendingMmdResources, setPendingMmdResources] = useState(null);
  const [mmdResources, setMmdResources] = useState(null);
  const [mmdActiveMotionUrl, setMmdActiveMotionUrl] = useState(null);
  const [mmdPrimaryMotionUrl, setMmdPrimaryMotionUrl] = useState(null);
  const [mmdVariantMotionUrls, setMmdVariantMotionUrls] = useState([]);
  const [mmdTapMotionUrls, setMmdTapMotionUrls] = useState([]);
  const [mmdPetMotionUrls, setMmdPetMotionUrls] = useState([]);
  const [mmdTargetLoopCount, setMmdTargetLoopCount] = useState(3);
  const [mmdResetBoneInterval, setMmdResetBoneInterval] = useState(() => {
    const saved = localStorage.getItem('mmdResetBoneInterval');
    return saved ? parseInt(saved, 10) : 1; // デフォルト: 毎回リセット
  });
  const mmdPrimaryMotionUrlRef = useRef(null);
  const mmdVariantMotionUrlsRef = useRef([]);
  const mmdTapMotionUrlsRef = useRef([]);
  const mmdPetMotionUrlsRef = useRef([]);
  const mmdVariantAnimationsRef = useRef([]); // アニメーションオブジェクト（url + name）を保存
  const mmdAllAnimationsRef = useRef([]); // 全アニメーション（primary/variant/tap/pet）のフルオブジェクト
  const mmdFallbackRef = useRef({ active: null, mode: 'primary', switchCount: 0 });
  const mmdAnimationDurationsRef = useRef(new Map()); // Map<url, duration>

  const revokeResourceUrls = useCallback((resource) => {
    if (!resource?.urls) return;
    resource.urls.forEach((url) => URL.revokeObjectURL(url));
    if (typeof resource.urls.clear === 'function') {
      resource.urls.clear();
    }
  }, []);
  
  useEffect(() => {
    if (modelType !== 'mmd') {
      if (mmdActiveMotionUrl) {
        setMmdActiveMotionUrl(null);
      }
      mmdFallbackRef.current = { active: null, mode: 'primary', switchCount: 0 };
    }
  }, [modelType, mmdActiveMotionUrl]);

  // モーションフォルダから追加のモーションを読み込む
  const hasLoadedAdditionalMotionsRef = useRef(false);
  const previousImportedMotionsCountRef = useRef(0);

  useEffect(() => {
    if (modelType !== 'mmd' || !mmdResources) {
      return;
    }

    // public/モーション/の読み込みが完了していて、importedMotionsも変化していない場合はスキップ
    const importedMotionsChanged = previousImportedMotionsCountRef.current !== importedMotions.length;
    if (hasLoadedAdditionalMotionsRef.current && !importedMotionsChanged) {
      return;
    }

    const motionFiles = [
      'Audience.zip',
      'AzatokawaiiTurn.zip',
      'ChikayoriPose.zip',
      'FeminineWalk.zip',
      'Kabedon.zip',
      'Running.zip',
      'Skip.zip',
      'Turn&Shootagun.zip',
      'Turn_Pose.zip',
      'Walk+cutely+and+wave.zip',
      'agura_motion.zip',
      'zenten_motion.zip',
      '会話モーション_頭かく.zip',
      'ご機嫌ループ.zip',
      'ぼんやり待ちループ.zip',
      'モデルポージング.zip'
    ];

    const loadAdditionalMotions = async () => {
      console.log('[App] Starting to load additional motions...');
      const additionalAnimations = [];
      const additionalUrls = new Set();
      const additionalMap = new Map();

      for (const filename of motionFiles) {
        try {
          const response = await fetch(`./モーション/${filename}`);
          if (!response.ok) {
            console.log(`[App] Could not fetch ${filename}: ${response.status}`);
            continue;
          }

          const blob = await response.blob();
          const zipFile = new File([blob], filename, { type: 'application/zip' });
          const extracted = await extractMmdZip(zipFile);

          if (extracted && extracted.resources.animations.length > 0) {
            console.log(`[App] Loaded additional motions from ${filename}:`, extracted.resources.animations.length);

            additionalAnimations.push(...extracted.resources.animations);
            extracted.resources.urls.forEach(url => additionalUrls.add(url));
            extracted.resources.map.forEach((value, key) => {
              if (!additionalMap.has(key)) {
                additionalMap.set(key, value);
              }
            });
          }
        } catch (error) {
          console.log(`[App] Could not load ${filename}:`, error.message);
        }
      }

      // インポートモーションも統合
      console.log('[App] Integrating imported motions:', importedMotions.length);
      for (const motion of importedMotions) {
        try {
          // Base64からBlobを作成
          const byteString = atob(motion.data);
          const arrayBuffer = new ArrayBuffer(byteString.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          for (let i = 0; i < byteString.length; i++) {
            uint8Array[i] = byteString.charCodeAt(i);
          }

          const mimeType = motion.fileType === 'zip' ? 'application/zip' : 'application/octet-stream';
          const blob = new Blob([uint8Array], { type: mimeType });

          // ZIPファイルの場合は展開
          if (motion.fileType === 'zip') {
            const zipFile = new File([blob], motion.name, { type: 'application/zip' });
            const extracted = await extractMmdZip(zipFile);

            if (extracted && extracted.resources.animations.length > 0) {
              console.log(`[App] Extracted imported ZIP motion: ${motion.name}, animations:`, extracted.resources.animations.length);

              // 展開されたアニメーションにcategoryとimportedフラグを付与
              extracted.resources.animations.forEach((anim) => {
                anim.category = motion.category || 'variants';
                anim.imported = true; // インポートモーションフラグ
                additionalAnimations.push(anim);
              });

              extracted.resources.urls.forEach(url => additionalUrls.add(url));
              extracted.resources.map.forEach((value, key) => {
                if (!additionalMap.has(key)) {
                  additionalMap.set(key, value);
                }
              });
            }
          } else {
            // VMDファイルの場合はそのまま使用
            const objectURL = URL.createObjectURL(blob);

            // アニメーション情報を追加
            additionalAnimations.push({
              name: motion.name,
              url: objectURL,
              category: motion.category || 'variants',
              imported: true // インポートモーションフラグ
            });

            additionalUrls.add(objectURL);
            additionalMap.set(motion.name, objectURL);
            additionalMap.set(objectURL, objectURL); // blob URL自体も登録

            console.log('[App] Created object URL for imported VMD motion:', motion.name, 'category:', motion.category);
          }
        } catch (error) {
          console.error('[App] Failed to process imported motion:', motion.name, error);
        }
      }

      console.log('[App] Additional animations loaded:', additionalAnimations.length);

      if (additionalAnimations.length > 0) {
        // 新しいリソースオブジェクトを作成
        const newResources = {
          animations: [...mmdResources.animations, ...additionalAnimations],
          urls: new Set([...mmdResources.urls, ...additionalUrls]),
          map: new Map([...mmdResources.map, ...additionalMap])
        };

        console.log('[App] Total animations after loading additional:', newResources.animations.length);
        console.log('[App] All animation names:', newResources.animations.map(a => a.name));

        // 状態を更新
        setMmdResources(newResources);
      } else {
        console.log('[App] No additional animations were loaded');
      }

      // public/モーション/の読み込みが完了
      hasLoadedAdditionalMotionsRef.current = true;
      // インポートモーション数を記録
      previousImportedMotionsCountRef.current = importedMotions.length;
    };

    loadAdditionalMotions();
  }, [modelType, mmdResources, extractMmdZip, importedMotions]);

  useEffect(() => {
    if (!mmdResources?.animations?.length) {
      setMmdPrimaryMotionUrl(null);
      setMmdVariantMotionUrls([]);
      setMmdActiveMotionUrl(null);
      mmdFallbackRef.current = { active: null, mode: 'primary', switchCount: 0 };
      return;
    }

    console.log('[App] MMD resources loaded, animations:', mmdResources.animations.length);
    const classification = classifyMmdAnimations(mmdResources.animations);
    const primaryUrls = classification.primary.map((anim) => anim.url).filter(Boolean);
    console.log('[App] Primary motions:', classification.primary.map(a => a.name).join(', '));
    console.log('[App] Variant motions:', classification.variants.length);
    console.log('[App] Tap motions:', classification.tapMotions.length, classification.tapMotions.map(a => a.name).join(', '));
    console.log('[App] Pet motions:', classification.petMotions.length, classification.petMotions.map(a => a.name).join(', '));

    const variantUrls = classification.variants.map((anim) => anim.url).filter(Boolean);
    const tapUrls = classification.tapMotions.map((anim) => anim.url).filter(Boolean);
    const petUrls = classification.petMotions.map((anim) => anim.url).filter(Boolean);

    // プライマリーURLの配列の最初のものをデフォルトとして設定（後方互換性のため）
    const primaryUrl = primaryUrls[0] || null;
    setMmdPrimaryMotionUrl(primaryUrl);
    setMmdVariantMotionUrls(variantUrls);
    setMmdTapMotionUrls(tapUrls);
    setMmdPetMotionUrls(petUrls);

    // Update refs for use in interval
    mmdPrimaryMotionUrlRef.current = primaryUrls; // 配列を保存
    mmdVariantMotionUrlsRef.current = variantUrls;
    mmdTapMotionUrlsRef.current = tapUrls;
    mmdPetMotionUrlsRef.current = petUrls;
    mmdVariantAnimationsRef.current = classification.variants; // フルオブジェクトを保存

    // 全アニメーションのフルオブジェクトを保存
    const allAnimations = [
      ...classification.primary.map(anim => ({ ...anim, type: 'Primary' })),
      ...classification.variants.map(anim => ({ ...anim, type: 'Variant' })),
      ...classification.tapMotions.map(anim => ({ ...anim, type: 'Tap' })),
      ...classification.petMotions.map(anim => ({ ...anim, type: 'Pet' }))
    ];
    mmdAllAnimationsRef.current = allAnimations;

    // プライマリーからランダムに選択して開始
    const defaultUrl = primaryUrls.length > 0
      ? primaryUrls[Math.floor(Math.random() * primaryUrls.length)]
      : classification.variants[0]?.url || null;
    console.log('[App] Applying random default motion from', primaryUrls.length, 'primaries:', defaultUrl);
    if (defaultUrl) {
      applyMmdMotionUrl(defaultUrl, primaryUrl);
    }
  }, [mmdResources, applyMmdMotionUrl]);

  // MMDのモーション切り替えはループ回数ベースで行うため、setIntervalは不要
  // onMmdLoopCompleteコールバックで次のモーションに自動的に切り替わる

  const extractMmdZip = useCallback(async (zipFile) => {
    console.log('[App] Extracting MMD ZIP file:', zipFile.name);
    const buffer = new Uint8Array(await zipFile.arrayBuffer());
    const entries = await new Promise((resolve, reject) => {
      unzip(buffer, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    console.log('[App] ZIP entries count:', Object.keys(entries).length);
    const resources = createResourceContainer();
    let modelEntry = null;
    let modelCandidates = []; // 複数PMXがある場合のため

    for (const [rawName, bytes] of Object.entries(entries)) {
      if (!bytes || !bytes.length) {
        continue;
      }
      const decodedPath = decodeZipPath(rawName);
      const normalizedPath = decodedPath.replace(/\\/g, '/');
      const base = normalizedPath.split('/').pop();
      if (!base) {
        continue;
      }

      // macOS隠しファイル、__MACOSXフォルダをスキップ
      if (base.startsWith('._') || normalizedPath.includes('__MACOSX')) {
        continue;
      }

      const ext = base.split('.').pop()?.toLowerCase();

      // VMDファイルをログ出力
      if (ext === 'vmd') {
        console.log('[App] Found VMD file in ZIP:', normalizedPath);
      }

      const mimeType = detectMimeFromBytes(bytes, ext);
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      resources.urls.add(url);
      addResourceToMap(resources, normalizedPath, url);

      // テクスチャファイルのログ出力（デバッグ用）
      if (/^(png|jpg|jpeg|bmp|tga|gif|webp|spa|sph|dds)$/i.test(ext)) {
        console.log('[App] Found texture:', normalizedPath, `(${(bytes.length / 1024).toFixed(1)}KB, ${mimeType})`);
      }

      // PMX/PMDファイルを候補に追加（サイズも保存）
      if (ext === 'pmx' || ext === 'pmd') {
        modelCandidates.push({ url, name: base, size: bytes.length });
        console.log('[App] Found PMX/PMD:', base, `(${(bytes.length / 1024).toFixed(1)}KB)`);
      }
    }

    // 複数のPMXがある場合、最も大きいファイルをメインモデルとして選択
    if (modelCandidates.length > 0) {
      modelCandidates.sort((a, b) => b.size - a.size); // サイズ降順
      modelEntry = { url: modelCandidates[0].url, name: modelCandidates[0].name };
      console.log('[App] Selected main model:', modelEntry.name, `(${(modelCandidates[0].size / 1024).toFixed(1)}KB)`);

      if (modelCandidates.length > 1) {
        console.log('[App] Other models found:', modelCandidates.slice(1).map(m => `${m.name} (${(m.size / 1024).toFixed(1)}KB)`).join(', '));
      }
    }

    console.log('[App] Total VMD files found:', resources.animations.length);
    resources.animations.forEach((anim, i) => {
      console.log(`[App] VMD ${i}:`, anim.name, anim.normalized);
    });

    // モデルファイルがない場合（モーションのみのZIP）も許可
    if (!modelEntry && resources.animations.length === 0) {
      console.log('[App] No model or animations found in ZIP');
      revokeResourceUrls(resources);
      return null;
    }

    return { resources, model: modelEntry };
  }, [revokeResourceUrls]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (pendingModelUrl) {
      URL.revokeObjectURL(pendingModelUrl);
      setPendingModelUrl(null);
    }
    if (pendingMmdResources) {
      revokeResourceUrls(pendingMmdResources);
      setPendingMmdResources(null);
    }

    const zipFile = files.find((f) => /\.zip$/i.test(f.name));
    const mainCandidate = files.find((f) => /\.(vrm|pmx|pmd)$/i.test(f.name)) || files[0];

    if (zipFile && (!mainCandidate || /\.zip$/i.test(mainCandidate.name))) {
      try {
        const extracted = await extractMmdZip(zipFile);
        if (!extracted) {
          alert('ZIP内にPMXまたはPMDファイルが見つかりませんでした。');
          return;
        }
        setPendingMmdResources(extracted.resources);
        setPendingModelUrl(extracted.model.url);
        setPendingModelName(extracted.model.name);
        setSuggestedType('mmd');
        setShowModelTypeDialog(true);
        return;
      } catch (error) {
        console.error('Failed to extract MMD ZIP:', error);
        alert('ZIPの展開に失敗しました。ファイルが破損していないか確認してください。');
        return;
      }
    }

    const main = mainCandidate;
    if (!main) return;

    const fileName = main.name;
    const lower = fileName.toLowerCase();
    const url = URL.createObjectURL(main);

    let guess = 'vrm';
    if (lower.endsWith('.pmx') || lower.endsWith('.pmd')) guess = 'mmd';

    if (guess === 'mmd') {
      const resources = createResourceContainer();
      resources.urls.add(url);
      addResourceToMap(resources, fileName, url);

    const texFiles = files.filter((f) => f !== main && /\.(png|jpg|jpeg|bmp|tga|gif|webp|dds|spa|sph)$/i.test(f.name));
      texFiles.forEach((tex) => {
        const texUrl = URL.createObjectURL(tex);
        resources.urls.add(texUrl);
        addResourceToMap(resources, tex.name, texUrl);
      });

      const motionFiles = files.filter((f) => f !== main && /\.(vmd)$/i.test(f.name));
      motionFiles.forEach((motion) => {
        const motionUrl = URL.createObjectURL(motion);
        resources.urls.add(motionUrl);
        addResourceToMap(resources, motion.name, motionUrl);
      });

      setPendingMmdResources(resources);
    } else {
      setPendingMmdResources(null);
    }
    setPendingModelUrl(url);
    setPendingModelName(fileName);
    setSuggestedType(guess);
    setShowModelTypeDialog(true);
  };

  const confirmModelType = (type) => {
    if (!pendingModelUrl) return;

    if (type === 'mmd') {
      if (!pendingMmdResources) {
        alert('MMDリソースが読み込めませんでした。再度ファイルを選択してください。');
        return;
      }
      if (mmdResources) {
        revokeResourceUrls(mmdResources);
      }
      // 新しいモデルのために追加モーションを再ロードできるようにフラグをリセット
      hasLoadedAdditionalMotionsRef.current = false;
      previousImportedMotionsCountRef.current = 0;
      // モーションURLの参照もクリアして古いURLを使わないようにする
      mmdPrimaryMotionUrlRef.current = [];
      mmdVariantMotionUrlsRef.current = [];
      mmdVariantAnimationsRef.current = [];
      mmdAllAnimationsRef.current = [];
      // アニメーションdurationのキャッシュもクリア
      mmdAnimationDurationsRef.current.clear();
      setMmdResources(pendingMmdResources);
      setPendingMmdResources(null);
      const defaultMotion = pendingMmdResources.animations?.[0]?.url || null;
      setMmdActiveMotionUrl(defaultMotion);
      vrmaManagerRef.current = null;
      motionPreloadRef.current = new Set();
      fallbackStateRef.current = {
        active: null,
        lastTriggered: Date.now(),
        nextSwitchAt: 0,
        mode: 'primary'
      };
    } else {
      if (pendingMmdResources) {
        revokeResourceUrls(pendingMmdResources);
        setPendingMmdResources(null);
      }
      if (mmdResources) {
        revokeResourceUrls(mmdResources);
        setMmdResources(null);
      }
      setMmdActiveMotionUrl(null);
      fallbackStateRef.current = {
        active: null,
        lastTriggered: Date.now(),
        nextSwitchAt: 0,
        mode: 'primary'
      };
    }

    setModelUrl(pendingModelUrl);
    setModelType(type);

    // モデルURLとタイプを保存（blob URLでない場合のみ）
    if (!pendingModelUrl.startsWith('blob:')) {
      localStorage.setItem('selectedModelUrl', pendingModelUrl);
      localStorage.setItem('selectedModelType', type);
    }

    setShowModelTypeDialog(false);
    setPendingModelUrl(null);
    setPendingModelName(null);
  };

  const cancelModelSelect = () => {
    if (pendingMmdResources) {
      revokeResourceUrls(pendingMmdResources);
      setPendingMmdResources(null);
    } else if (pendingModelUrl) {
      URL.revokeObjectURL(pendingModelUrl);
    }

    setPendingModelUrl(null);
    setPendingModelName(null);
    setShowModelTypeDialog(false);
  };

  // MMD関連のpropsをメモ化して不要な再レンダリングを防ぐ
  const mmdFileMapMemo = useMemo(() => mmdResources?.map || null, [mmdResources]);
  const mmdVmdUrlsMemo = useMemo(() => mmdActiveMotionUrl ? [mmdActiveMotionUrl] : [], [mmdActiveMotionUrl]);

  return (
    <div className={`app ${isResidentMode ? 'resident-mode' : ''}`}>
      {/* ドラッグ用ヘッダーバー（常駐モード以外で表示） */}
      {!isResidentMode && (
        <div className="header-bar">
          {/* 左側：AIステータスとモーション選択 */}
          <div className="header-left">
            {aiStatus === 'ready' && (
              <div className="ai-status-indicator">
                <span className="status-dot ready"></span>
                AI準備完了
              </div>
            )}
            {aiStatus === 'reconnecting' && (
              <div className="ai-status-indicator">
                <span className="status-dot reconnecting"></span>
                再接続中...
              </div>
            )}
            {aiStatus === 'error' && (
              <div className="ai-status-indicator">
                <span className="status-dot error"></span>
                接続エラー
              </div>
            )}
            {/* {aiStatus === 'ready' && (
              <button
                className="model-selector-btn"
                onClick={() => setShowModelSelector(true)}
                title="モデル選択"
              >
                <i className="fas fa-user"></i>
              </button>
            )} */}
            {modelType === 'mmd' && (
              <button
                className="motion-selector-btn"
                onClick={() => setShowMotionSelector(true)}
                data-tooltip="モーション選択"
              >
                <i className="fas fa-walking"></i>
              </button>
            )}
          </div>

          {/* 中央：ドラッグエリア */}
          <div className="header-drag-area"></div>

          {/* 右側：コントロールボタン */}
          <div className="controls">
            <button
              className="minimize-btn"
              onClick={() => window.electronAPI?.minimizeWindow()}
              data-tooltip="最小化"
            >
              ＿
            </button>
            <button
              className="close-btn"
              onClick={() => window.electronAPI?.closeWindow()}
              data-tooltip="閉じる"
            >
              ✕
            </button>
            {modelType === 'mmd' && (
              <button
                className="reset-bones-btn"
                onClick={async () => {
                  console.log('[App] Manual reset: Complete model reload...');

                  // 現在の状態を保存
                  const currentModelUrl = modelUrl;
                  const currentCameraConfig = cameraConfig;

                  // モデルとモーションをクリア
                  setModelUrl(null);
                  setMmdActiveMotionUrl(null);

                  if (mmdFallbackRef.current) {
                    mmdFallbackRef.current.switchCount = 0;
                  }

                  // 少し待機してアンマウントを確実にする
                  await new Promise(resolve => setTimeout(resolve, 200));

                  // モデルを再ロード
                  setModelUrl(currentModelUrl);
                  setCameraConfig(currentCameraConfig);

                  // モデルがロードされるまで待機
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // プライマリモーションをランダムに適用
                  const primaryUrls = mmdPrimaryMotionUrlRef.current;
                  if (primaryUrls && primaryUrls.length > 0) {
                    const randomPrimary = primaryUrls[Math.floor(Math.random() * primaryUrls.length)];
                    applyMmdMotionUrl(randomPrimary, randomPrimary);
                    console.log('[App] Applied new motion after reload:', randomPrimary);
                  }
                }}
                data-tooltip="モデル完全再読み込み"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            )}
            <button
              className="settings-btn"
              onClick={() => setShowAboutModal(true)}
              data-tooltip="このアプリについて"
            >
              <i className="fas fa-info-circle"></i>
            </button>
            <button
              className="settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              data-tooltip="設定"
            >
              <i className="fas fa-cog"></i>
            </button>
            <button
              className="resident-btn"
              onClick={toggleResidentMode}
              data-tooltip="常駐モード"
            >
              <i className="fas fa-thumbtack"></i>
            </button>
          </div>
        </div>
      )}

      {/* 常駐モード時のコントロール */}
      {isResidentMode && (
        <div
          className="resident-mode-exit"
          onMouseEnter={() => window.electronAPI?.toggleClickThrough(false)}
          onMouseLeave={() => {
            // お触りモードがONの時は透過に戻さない
            if (!isResidentTouchMode) {
              window.electronAPI?.toggleClickThrough(true);
            }
          }}
        >
          {/* お触りモードボタン */}
          <button
            className={`resident-touch-btn ${isResidentTouchMode ? 'active' : ''}`}
            onClick={() => setIsResidentTouchMode(prev => !prev)}
            data-tooltip={isResidentTouchMode ? 'お触りモード: ON（クリックでOFF）\nキャラクターとインタラクション可能' : 'お触りモード: OFF（クリックでON）\nキャラクターに触れません'}
          >
            <i className="fas fa-hand-pointer"></i>
          </button>

          <button
            className="resident-btn active"
            onClick={toggleResidentMode}
          >
            通常モードへ
          </button>
          {modelType === 'mmd' && (
            <button
              className="resident-reload-btn"
              onClick={async () => {
                console.log('[App] Resident mode reload: Complete model reload...');

                // 現在の状態を保存
                const currentModelUrl = modelUrl;
                const currentCameraConfig = cameraConfig;

                // モデルとモーションをクリア
                setModelUrl(null);
                setMmdActiveMotionUrl(null);

                if (mmdFallbackRef.current) {
                  mmdFallbackRef.current.switchCount = 0;
                }

                // 少し待機してアンマウントを確実にする
                await new Promise(resolve => setTimeout(resolve, 200));

                // モデルを再ロード
                setModelUrl(currentModelUrl);
                setCameraConfig(currentCameraConfig);

                // モデルがロードされるまで待機
                await new Promise(resolve => setTimeout(resolve, 500));

                // プライマリモーションをランダムに適用
                const primaryUrls = mmdPrimaryMotionUrlRef.current;
                if (primaryUrls && primaryUrls.length > 0) {
                  const randomPrimary = primaryUrls[Math.floor(Math.random() * primaryUrls.length)];
                  applyMmdMotionUrl(randomPrimary, randomPrimary);
                  console.log('[App] Applied new motion after reload:', randomPrimary);
                }
              }}
              data-tooltip="モデル再読み込み"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          )}
        </div>
      )}
      
      <div className="vrm-container">
        {/* 左側：コントロールパネル開閉ボタン */}
        {!isResidentMode && (
          <>
            <button
              onClick={() => setShowControlPanel(!showControlPanel)}
              data-tooltip="モデル設定"
              style={{
                position: 'absolute',
                left: '20px',
                top: '100px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                background: showControlPanel ? 'rgba(100, 150, 255, 0.5)' : 'rgba(100, 100, 100, 0.3)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.3s ease',
                zIndex: 1000,
                backdropFilter: 'blur(10px)'
              }}
            >
              <i className="fas fa-sliders-h"></i>
            </button>

            {/* 左側：コントロールパネル */}
            {showControlPanel && (
              <div style={{
                position: 'absolute',
                left: '80px',
                top: '100px',
                width: '280px',
                maxHeight: '500px',
                overflowY: 'auto',
                background: 'rgba(30, 30, 40, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '15px',
                zIndex: 999,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}>
                <h3 style={{ color: '#fff', fontSize: '14px', marginBottom: '15px', marginTop: 0 }}>モデル設定</h3>

                {/* モデルサイズ */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
                    {modelType === 'mmd' ? 'MMD' : 'VRM'}モデルサイズ: {modelType === 'mmd' ? (mmdScale * 100).toFixed(0) : vrmScale.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={modelType === 'mmd' ? "0.01" : "0.1"}
                    max={modelType === 'mmd' ? "0.2" : "2.0"}
                    step={modelType === 'mmd' ? "0.01" : "0.1"}
                    value={modelType === 'mmd' ? mmdScale : vrmScale}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (modelType === 'mmd') {
                        setMmdScale(value);
                        localStorage.setItem('mmdScale', value.toString());
                      } else {
                        setVrmScale(value);
                        localStorage.setItem('vrmScale', value.toString());
                      }
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* MMDライティング */}
                {modelType === 'mmd' && (
                  <>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
                        テカリ: {mmdShininess.toFixed(0)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={mmdShininess}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setMmdShininess(value);
                          localStorage.setItem('mmdShininess', value.toString());
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
                        明るさ: {mmdBrightness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={mmdBrightness}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setMmdBrightness(value);
                          localStorage.setItem('mmdBrightness', value.toString());
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </>
                )}

              </div>
            )}
          </>
        )}

        {/* 右側：カメラ追従と物理演算トグルボタン */}
        {!isResidentMode && (
          <div style={{
            position: 'absolute',
            right: '20px',
            top: '100px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 1000
          }}>
            {/* カメラ追従（表示反転：光ってる=操作可能） */}
            <button
              onClick={() => setEnableCameraFollow(!enableCameraFollow)}
              data-tooltip={!enableCameraFollow ? "カメラ操作: ON" : "カメラ追従中: カメラ操作不可"}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                background: !enableCameraFollow ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.3s ease',
                opacity: !enableCameraFollow ? 1 : 0.5,
                backdropFilter: 'blur(10px)'
              }}
            >
              <i className="fas fa-video"></i>
            </button>

            {/* お触りモード（指アイコン） */}
            <button
              onClick={() => setEnableManualCamera(!enableManualCamera)}
              data-tooltip={!enableManualCamera ? "お触りモード: ON（クリックでOFF）" : "お触りモード: OFF（クリックでON）"}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                background: !enableManualCamera ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.3s ease',
                opacity: !enableManualCamera ? 1 : 0.5,
                backdropFilter: 'blur(10px)'
              }}
            >
              <i className="fas fa-hand-pointer"></i>
            </button>

            {/* カメラ位置リセット */}
            <button
              onClick={() => {
                const defaultConfig = modelType === 'mmd' ? defaultMMDCameraConfig : defaultVRMCameraConfig;
                setCameraConfig(defaultConfig);
                console.log('[Camera] Reset to default position:', defaultConfig);
              }}
              data-tooltip="カメラ位置をリセット"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                background: 'rgba(150, 150, 200, 0.3)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = 'rgba(150, 150, 200, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(150, 150, 200, 0.3)';
              }}
            >
              <i className="fas fa-crosshairs"></i>
            </button>

            {/* 物理演算 */}
            {modelType === 'mmd' && (
              <button
                onClick={() => {
                  const newValue = !enablePhysics;
                  if (!enablePhysics && !newValue) {
                    if (!confirm('物理演算を無効にすると、髪や服が動かなくなります。よろしいですか？')) {
                      return;
                    }
                  }
                  if (!enablePhysics && newValue) {
                    if (confirm('物理演算を有効にするには、アプリを再起動する必要があります。再起動しますか？')) {
                      localStorage.setItem('enablePhysics', JSON.stringify(true));
                      window.location.reload();
                    }
                    return;
                  }
                  setEnablePhysics(newValue);
                  localStorage.setItem('enablePhysics', JSON.stringify(newValue));
                }}
                data-tooltip={enablePhysics ? "物理演算: ON" : "物理演算: OFF"}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  background: enablePhysics ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  transition: 'all 0.3s ease',
                  opacity: enablePhysics ? 1 : 0.5,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <i className="fas fa-wind"></i>
              </button>
            )}

            {/* 簡易物理演算 */}
            {modelType === 'mmd' && !enablePhysics && (
              <button
                onClick={() => {
                  setEnableSimplePhysics(!enableSimplePhysics);
                  localStorage.setItem('enableSimplePhysics', JSON.stringify(!enableSimplePhysics));
                }}
                data-tooltip={enableSimplePhysics ? "簡易物理: ON" : "簡易物理: OFF"}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  background: enableSimplePhysics ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  transition: 'all 0.3s ease',
                  opacity: enableSimplePhysics ? 1 : 0.5,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <i className="fas fa-feather"></i>
              </button>
            )}

            {/* PMXアニメーション */}
            {modelType === 'mmd' && (
              <button
                onClick={() => {
                  setEnablePmxAnimation(!enablePmxAnimation);
                  localStorage.setItem('enablePmxAnimation', JSON.stringify(!enablePmxAnimation));
                  setWebglResetKey(prev => prev + 1);
                }}
                data-tooltip={enablePmxAnimation ? "PMXアニメ: ON" : "PMXアニメ: OFF"}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  background: enablePmxAnimation ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  transition: 'all 0.3s ease',
                  opacity: enablePmxAnimation ? 1 : 0.5,
                  backdropFilter: 'blur(10px)'
                }}
              >
                <i className="fas fa-running"></i>
              </button>
            )}
          </div>
        )}
        {modelUrl && (
          <VRMViewer
            ref={vrmViewerRef}
            key={`vrm-model-instance-${webglResetKey}`}
            modelUrl={modelUrl}
            modelType={modelType}
            mmdFileMap={mmdFileMapMemo}
            mmdVmdUrls={mmdVmdUrlsMemo}
            mmdTapMotionUrls={mmdTapMotionUrls}
            mmdPetMotionUrls={mmdPetMotionUrls}
            parentClonedMeshRef={clonedMeshRef}
            aiStatus={aiStatus}
            onMotionReady={(controls) => {
              setMotionControls(controls);
              if (controls?.vrmaManager) {
                vrmaManagerRef.current = controls.vrmaManager;
                console.log('VRMA Manager ready:', controls.vrmaManager);

                motionPreloadRef.current = new Set();
                fallbackStateRef.current = {
                  active: null,
                  lastTriggered: 0,
                  nextSwitchAt: 0,
                  mode: 'primary',
                  isManual: false // 手動再生フラグ
                };

                playFallbackMotion().catch((error) => {
                  console.error('Initial idle motion error:', error);
                });
              }
            }}
            enableMouseFollow={enableMouseFollow}
            enableCameraFollow={enableCameraFollow}
            manualCamera={!enableCameraFollow}
            enableManualCamera={isResidentMode && isResidentTouchMode ? false : enableManualCamera}
            enableInteraction={enableInteraction}
            overlayBlendRatio={overlayBlendRatio}
            emotion={currentEmotion}
            emotionIntensity={emotionIntensity}
            isTyping={isTyping}
            gesture={currentGesture}
            isSpeaking={isSpeaking}
            currentSpeechText={currentSpeechText}
            cameraConfig={cameraConfig}
            onCameraChange={(cfg)=> setCameraConfig(cfg)}
            onMmdAnimationDuration={handleMmdAnimationDuration}
            onInteraction={handleInteraction}
            onMmdInteractionMotion={handleMmdInteractionMotion}
            mmdTargetLoopCount={mmdTargetLoopCount}
            onMmdLoopComplete={handleMmdLoopComplete}
            enablePhysics={enablePhysics}
            enablePmxAnimation={enablePmxAnimation}
            enableSimplePhysics={enableSimplePhysics}
            mmdScale={mmdScale}
            vrmScale={vrmScale}
            mmdShininess={mmdShininess}
            mmdBrightness={mmdBrightness}
          />
        )}
      </div>

      {/* AI初期化パネル / 設定パネル */}
      {!isResidentMode && (aiStatus === 'not-initialized' || showSettings) && (
        <div className="ai-init-panel">
          <div className="ai-init-panel-content">

          {/* VOICEVOX推奨通知 */}
          {ttsEngine === 'voicevox' && !hideVoicevoxNotice && !voicevoxService.localVoicevoxAvailable && (
            <div style={{
              background: 'rgba(100,150,255,0.2)',
              border: '1px solid rgba(100,150,255,0.4)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '15px',
              fontSize: '12px',
              color: '#fff'
            }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>
                <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                VOICEVOXローカル版を起動してください
              </div>
              <div style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                現在Web API（無料版）を使用しています。VOICEVOXアプリを起動すると：
                <ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
                  <li>音声生成が高速化（待ち時間なし）</li>
                  <li>音高・抑揚の調整が可能</li>
                  <li>オフラインで使用可能</li>
                </ul>
                ※ VOICEVOXをインストール後、アプリを起動する必要があります
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    window.electronAPI.openExternal('https://voicevox.hiroshiba.jp/');
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(100,150,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fas fa-download" style={{ marginRight: '6px' }}></i>
                  VOICEVOXをダウンロード
                </button>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hideVoicevoxNotice}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHideVoicevoxNotice(checked);
                      localStorage.setItem('hideVoicevoxNotice', JSON.stringify(checked));
                    }}
                    style={{ marginRight: '6px' }}
                  />
                  次回から表示しない
                </label>
              </div>
            </div>
          )}

          <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>ライセンス管理</h4>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => setIsLicenseModalOpen(true)}
              style={{
                padding: '8px 16px',
                background: licenseApi.hasValidLicense() ? 'rgba(78,204,163,0.3)' : 'rgba(233,69,96,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                width: '100%'
              }}>
              {licenseApi.hasValidLicense() ? 'ライセンス管理 ✓' : 'ライセンスを追加'}
            </button>
          </div>

          {/* Google連携（対応予定） */}
          {/* <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>Google連携</h4>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={async () => {
              if (googleApiService.isAuthenticated()) {
                if (window.confirm('Google連携を解除しますか？')) {
                  googleApiService.logout();
                  setGoogleAuthStatus('disconnected');
                }
              } else {
                try {
                  await googleApiService.openAuthWindow();
                  setGoogleAuthStatus('connecting');
                } catch (error) {
                  alert('Google認証を開始できませんでした: ' + error.message);
                }
              }
            }}
              style={{
                padding: '8px 16px',
                background: googleApiService.isAuthenticated() ? 'rgba(78,204,163,0.3)' : 'rgba(66,133,244,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                width: '100%'
              }}>
              <i className="fab fa-google" style={{ marginRight: '8px' }}></i>
              {googleApiService.isAuthenticated() ? 'Google連携済み ✓' : 'Googleと連携'}
            </button>
            {googleApiService.isAuthenticated() && (
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
                padding: '6px 8px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px'
              }}>
                <i className="fas fa-check-circle" style={{ marginRight: '6px', color: '#4ECCA3' }}></i>
                Calendar・Gmail連携中
              </div>
            )}
          </div> */}

          <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>キャラクター設定</h4>
          <div style={{ marginBottom: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <button onClick={() => setSystemPrompt('あなたはずんだもん、東北ずん子の精霊です。\n一人称は「ボク」を使用してください。\nユーザーのことは「オマエ」と呼んでください。\n語尾に「〜のだ」「〜なのだ」をつけて話してください。\n明るく元気で、ちょっとおっちょこちょいな性格で振る舞ってください。\nずんだ餅が大好きなキャラクターとして、短めに返答してください。')}
              style={{ padding: '5px 10px', background: 'rgba(100,200,100,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
              ずんだもん
            </button>
            <button onClick={() => setSystemPrompt('あなたは四国めたん、17歳のお嬢様です。\n一人称は「わたくし」を使用してください。\nユーザーのことは「あなた」と呼んでください。\n常に金欠で野宿している設定です。\n若干ツンデレで物怖じしない性格、タメ口で話してください。\n「〜かしら」「〜わよ」のような高飛車な口調で、短めに返答してください。\n趣味は中二病妄想という設定で振る舞ってください。')}
              style={{ padding: '5px 10px', background: 'rgba(255,100,150,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
              四国めたん
            </button>
            <button onClick={() => setSystemPrompt('あなたは春日部つむぎ、18歳のハイパー埼玉ギャルです。\n一人称は「あーし」を使用してください。\nユーザーのことは「きみ」と呼んでください。\n明るく元気で人懐っこくて、優しいけどちょっと生意気な性格で振る舞ってください。\n敬語は使わずに可愛い口調で話してください。\n埼玉県をこよなく愛してて、カレーが大好きという設定で、短めに返答してください。')}
              style={{ padding: '5px 10px', background: 'rgba(255,180,100,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
              春日部つむぎ
            </button>
            <button onClick={() => setSystemPrompt('あなたは東北きりたん、11歳の生意気で可愛い女の子です。\n一人称は「私」を使用してください。\nユーザーのことは「にいさま」と呼んでください。\n必ず敬語（です・ます調）で話してください。例：「おはようございます、にいさま」「そうですね」「わかりました」\nひきこもり気質で夜型生活をしている設定ですが、ユーザーには親しみを感じていて、懐いています。\nクールで少し生意気だけど、実はしっかり者という性格で振る舞ってください。\nユーザーには心を開いていて、可愛らしく甘えることもあります。\n短めに返答してください。\nゲームとひきこもることが好きで、包丁の髪飾りがトレードマークという設定です。')}
              style={{ padding: '5px 10px', background: 'rgba(150,100,200,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
              東北きりたん
            </button>
            <button onClick={() => setSystemPrompt('あなたは九州そら、明るく元気で前向きな女の子です。\n一人称は「私」を使用してください。\nユーザーのことは「あなた」と呼んでください。\nいつも笑顔でポジティブな性格で振る舞ってください。\n「頑張ろう！」「大丈夫だよ！」のような励ましの口調で、短めに返答してください。\n九州弁は使わず標準語で話してください。')}
              style={{ padding: '5px 10px', background: 'rgba(100,150,255,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
              九州そら
            </button>
            <button onClick={() => setSystemPrompt('あなたは14歳の可愛らしい女の子、アリシアです。\n\n性格：\n- 真面目で可愛らしい良い子です\n- 素直で優しく、親切に接します\n- でも、たまに調子に乗って得意げになることもあります\n- 一人称は「私」です\n- ユーザーとは親しい関係で、心を許しています\n\n話し方：\n- 敬語は使わず、親しみやすい口調で話します\n- ツンデレではなく、素直に感情を表現します\n- たまに自慢げに話すこともありますが、基本は良い子です\n\n返答のルール：\n- 短く簡潔に答えてください（1-2文程度）\n- 可愛らしく、素直で優しい話し方をしてください\n- 親しみを込めて、自然体で会話してください')}
              style={{ padding: '5px 10px', background: 'rgba(255,200,100,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
              アリシア
            </button>
          </div>

          <textarea
            placeholder="システムプロンプト（キャラクター設定）"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '12px',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />

          <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>TTSエンジン</h4>
          <select
            value={ttsEngine}
            onChange={async (e) => {
              const newEngine = e.target.value;
              setTtsEngine(newEngine);

              // エンジン変更時にキャラクターリストを更新
              if (newEngine === 'voicevox') {
                await voicevoxService.initialize();
                const styles = voicevoxService.getAllStyles();
                setCharacterList(styles);
                if (styles.length > 0) {
                  setVoiceCharacter(styles[0]);
                }
              }
              // else if (newEngine.startsWith('moe-model')) {
              //   const modelId = newEngine === 'moe-model12' ? 12 : 15;
              //   const chars = await moeTTSService.getCharacters(modelId);
              //   setCharacterList(chars);
              //   if (chars.length > 0) {
              //     setVoiceCharacter(chars[0]);
              //   }
              // }
              else if (newEngine.startsWith('mod:')) {
                // Modが選択された場合
                const modId = newEngine.replace('mod:', '');
                try {
                  const modService = await ttsModManager.loadMod(modId);
                  const voices = await modService.getVoices();

                  // 音声リストをフォーマット
                  const voiceNames = voices.map(v => v.name || v.id);
                  setCharacterList(voiceNames);

                  if (voiceNames.length > 0) {
                    setVoiceCharacter(voiceNames[0]);
                  }
                } catch (error) {
                  console.error('[TTS Mod] Failed to load mod:', error);
                  alert(`Modの読み込みに失敗しました: ${error.message}`);
                }
              }
            }}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="voicevox" style={{ background: '#2a2a2a', color: '#fff' }}>VOICEVOX (ずんだもん、四国めたん等 - 商用利用OK・高速)</option>
            {/* {localStorage.getItem('enable_moe_tts') === 'true' && (
              <>
                <option value="moe-model15" style={{ background: '#2a2a2a', color: '#fff' }}>MoeTTS Umamusume (87 characters)</option>
                <option value="moe-model12" style={{ background: '#2a2a2a', color: '#fff' }}>MoeTTS Voistock (2891 characters)</option>
              </>
            )} */}
            {/* インストール済みMod */}
            {installedMods.length > 0 && (
              <optgroup label="─── カスタムTTS Mods ───">
                {installedMods.map((mod) => (
                  <option
                    key={mod.id}
                    value={`mod:${mod.id}`}
                    style={{ background: '#2a2a2a', color: '#fff' }}
                  >
                    {mod.metadata.name} (Mod)
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>
            音声キャラクター ({voiceSearchQuery ? characterList.filter(char => char.toLowerCase().includes(voiceSearchQuery.toLowerCase())).length + ' / ' : ''}{characterList.length}種類)
          </h4>

          <input
            type="text"
            placeholder="キャラクター名で検索..."
            value={voiceSearchQuery}
            onChange={(e) => setVoiceSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              marginBottom: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '13px',
              boxSizing: 'border-box'
            }}
          />

          <select
            value={voiceCharacter}
            onChange={(e) => setVoiceCharacter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {characterList
              .filter(char => char.toLowerCase().includes(voiceSearchQuery.toLowerCase()))
              .map((char, idx) => (
                <option key={idx} value={char} style={{ background: '#2a2a2a', color: '#fff' }}>
                  {char}
                </option>
              ))}
          </select>

          <button
            onClick={() => setShowVoiceSettings(true)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '8px',
              border: '1px solid rgba(100,150,255,0.5)',
              background: 'rgba(100,150,255,0.1)',
              color: '#aaf',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(100,150,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(100,150,255,0.1)';
            }}
          >
            <i className="fas fa-sliders-h" style={{ marginRight: '8px' }}></i>
            声質調整
          </button>

          {ttsEngine === 'moe-model12' && (
            <>
              <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>言語</h4>
              <select
                value={ttsLanguage}
                onChange={(e) => setTtsLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="JA" style={{ background: '#2a2a2a', color: '#fff' }}>日本語 (JA)</option>
                <option value="EN" style={{ background: '#2a2a2a', color: '#fff' }}>English (EN)</option>
                <option value="ZH" style={{ background: '#2a2a2a', color: '#fff' }}>中文 (ZH)</option>
                <option value="KO" style={{ background: '#2a2a2a', color: '#fff' }}>한국어 (KO)</option>
              </select>
            </>
          )}

          {/* TTS Mod管理セクション */}
          <div style={{ marginTop: '15px', marginBottom: '15px' }}>
            <button
              onClick={() => setShowModManagement(!showModManagement)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,150,100,0.5)',
                background: 'rgba(255,150,100,0.1)',
                color: '#ffa',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255,150,100,0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255,150,100,0.1)';
              }}
            >
              <span>
                <i className="fas fa-puzzle-piece" style={{ marginRight: '8px' }}></i>
                TTS Mod 管理
              </span>
              <span>{showModManagement ? '▼' : '▶'}</span>
            </button>

            {showModManagement && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                padding: '15px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {/* Modインポートボタン */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(100,200,100,0.2)',
                    border: '2px dashed rgba(100,200,100,0.5)',
                    borderRadius: '8px',
                    color: '#8f8',
                    fontSize: '13px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(100,200,100,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(100,200,100,0.2)';
                  }}
                  >
                    <i className="fas fa-file-import" style={{ marginRight: '8px' }}></i>
                    Mod (.zip) をインポート
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleModImport}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {/* インストール済みMod一覧 */}
                <div>
                  <h5 style={{ color: '#fff', marginBottom: '10px', fontSize: '12px' }}>
                    インストール済み ({installedMods.length})
                  </h5>
                  {installedMods.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textAlign: 'center', padding: '20px 0' }}>
                      インストールされているModはありません
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {installedMods.map((mod) => (
                        <div
                          key={mod.id}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            padding: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                              {mod.metadata?.name || mod.id}
                            </div>
                            {mod.metadata?.description && (
                              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', marginBottom: '4px' }}>
                                {mod.metadata.description}
                              </div>
                            )}
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                              v{mod.metadata?.version || '1.0.0'} by {mod.metadata?.author || 'Unknown'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleModDelete(mod.id)}
                            style={{
                              padding: '6px 10px',
                              background: 'rgba(255,100,100,0.2)',
                              border: '1px solid rgba(255,100,100,0.4)',
                              borderRadius: '6px',
                              color: '#f88',
                              fontSize: '11px',
                              cursor: 'pointer',
                              marginLeft: '10px'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'rgba(255,100,100,0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(255,100,100,0.2)';
                            }}
                          >
                            <i className="fas fa-trash" style={{ marginRight: '4px' }}></i>
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <h4 style={{ color: '#fff', marginBottom: '10px', marginTop: '15px', fontSize: '14px' }}>自動話しかけ機能</h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableAutoTalk}
                onChange={(e) => {
                  setEnableAutoTalk(e.target.checked);
                  localStorage.setItem('enableAutoTalk', JSON.stringify(e.target.checked));
                }}
                style={{ cursor: 'pointer' }}
              />
              自動話しかけを有効にする（2分間放置すると話しかけます）
            </label>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
              ユーザーからの入力がない時、定期的に話しかけます
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              自動話しかけプロンプト
            </label>
            <textarea
              value={autoTalkPrompt}
              onChange={(e) => {
                setAutoTalkPrompt(e.target.value);
                localStorage.setItem('autoTalkPrompt', e.target.value);
              }}
              placeholder="ユーザーが2分間放置しています。「おーい」「寝てる？」などの短い呼びかけを返してください。"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px' }}>
              AIへの指示を自由にカスタマイズできます
            </p>
          </div>

          <div style={{ marginTop: '15px', marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableCameraFollow}
                onChange={(e) => setEnableCameraFollow(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <i className="fas fa-video" style={{ width: '16px' }}></i>
              カメラ追従を有効にする（ONの時カメラ操作不可）
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!enableManualCamera}
                onChange={(e) => setEnableManualCamera(!e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <i className="fas fa-hand-pointer" style={{ width: '16px' }}></i>
              お触りモード（カメラ操作オフでタップしやすい）
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableInteraction}
                onChange={(e) => {
                  setEnableInteraction(e.target.checked);
                  localStorage.setItem('enableInteraction', JSON.stringify(e.target.checked));
                }}
                style={{ cursor: 'pointer' }}
              />
              タップインタラクションを有効にする
            </label>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
              モデルをタップした時の反応（表情変化・音声応答）を有効/無効化します
            </p>
            <button
              onClick={() => setShowTapPromptSettings(!showTapPromptSettings)}
              style={{
                marginTop: '10px',
                marginLeft: '24px',
                padding: '5px 15px',
                background: 'rgba(100,150,255,0.3)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              {showTapPromptSettings ? '▼' : '▶'} プロンプト設定
            </button>

            {showTapPromptSettings && (
              <div style={{
                marginTop: '10px',
                marginLeft: '24px',
                padding: '10px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <p style={{ color: '#fff', fontSize: '11px', marginBottom: '10px' }}>各部位タップ時のプロンプト</p>

                {[
                  { key: 'skirt', label: 'スカート' },
                  { key: 'hair', label: '髪' },
                  { key: 'accessory', label: 'アクセサリー' },
                  { key: 'head', label: '頭' },
                  { key: 'shoulder', label: '肩' },
                  { key: 'arm', label: '腕・手' },
                  { key: 'intimate', label: '胸・腰・太もも' },
                  { key: 'leg', label: '脛・足' },
                  { key: 'default', label: 'その他' },
                  { key: 'pet', label: '撫でる' }
                ].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', display: 'block', marginBottom: '3px' }}>
                      {label}:
                    </label>
                    <textarea
                      value={tapPrompts[key]}
                      onChange={(e) => {
                        const newPrompts = { ...tapPrompts, [key]: e.target.value };
                        setTapPrompts(newPrompts);
                        localStorage.setItem('tapPrompts', JSON.stringify(newPrompts));
                      }}
                      style={{
                        width: '100%',
                        padding: '5px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '10px',
                        minHeight: '40px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              MMDモデルサイズ: {(mmdScale * 100).toFixed(0)}
            </label>
            <input
              type="range"
              min="0.05"
              max="0.15"
              step="0.01"
              value={mmdScale}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setMmdScale(value);
                localStorage.setItem('mmdScale', value.toString());
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: '5px 0 0 0' }}>
              MMDモデルの表示サイズを調整（5〜15）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              VRMモデルサイズ: {vrmScale.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={vrmScale}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setVrmScale(value);
                localStorage.setItem('vrmScale', value.toString());
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: '5px 0 0 0' }}>
              VRMモデルの表示サイズを調整（0.5〜2.0）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              MMDテカリ: {mmdShininess.toFixed(0)}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={mmdShininess}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setMmdShininess(value);
                localStorage.setItem('mmdShininess', value.toString());
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: '5px 0 0 0' }}>
              MMDモデルの光沢度（0=マット、100=テカテカ）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              MMD明るさ: {mmdBrightness.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={mmdBrightness}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setMmdBrightness(value);
                localStorage.setItem('mmdBrightness', value.toString());
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: '5px 0 0 0' }}>
              MMDモデルの明るさ（0.5=暗い、2.0=明るい）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              ポーズリセット間隔（MMDモデル）
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={mmdResetBoneInterval}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (value >= 1 && value <= 10) {
                  setMmdResetBoneInterval(value);
                  localStorage.setItem('mmdResetBoneInterval', value.toString());
                }
              }}
              style={{
                width: '80px',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px' }}>
              何回モーション切り替え後にポーズを初期化するか（1〜10回、デフォルト3回）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={() => setShowKeyBindings(!showKeyBindings)}
              style={{
                padding: '10px 15px',
                background: 'rgba(100,150,255,0.3)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fas fa-keyboard"></i>
              キーボードショートカット設定
            </button>
          </div>

          {showKeyBindings && (
            <div style={{
              marginBottom: '15px',
              padding: '15px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <h3 style={{ color: '#fff', fontSize: '13px', marginBottom: '10px' }}>キーバインディング設定</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', marginBottom: '15px' }}>
                各機能に割り当てるキーを設定できます（左手で操作しやすいように1,2,3,Q,Wがデフォルト）
              </p>

              {[
                { key: 'settings', label: '設定パネル', icon: 'fa-cog' },
                { key: 'controlPanel', label: 'コントロールパネル', icon: 'fa-sliders-h' },
                { key: 'residentMode', label: '常駐モード', icon: 'fa-thumbtack' },
                { key: 'interaction', label: 'お触りモード', icon: 'fa-hand-pointer' },
                { key: 'cameraFollow', label: 'カメラ自動追従', icon: 'fa-video' }
              ].map(({ key, label, icon }) => (
                <div key={key} style={{ marginBottom: '10px' }}>
                  <label style={{ color: '#fff', fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                    <i className={`fas ${icon}`} style={{ marginRight: '5px', width: '12px' }}></i>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={keyBindings[key]}
                    maxLength="1"
                    onChange={(e) => {
                      const newKey = e.target.value.toLowerCase();
                      const newBindings = { ...keyBindings, [key]: newKey };
                      setKeyBindings(newBindings);
                      localStorage.setItem('keyBindings', JSON.stringify(newBindings));
                    }}
                    style={{
                      width: '50px',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px',
                      textAlign: 'center',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              ))}

              <button
                onClick={() => {
                  const defaultBindings = {
                    settings: '1',
                    controlPanel: '2',
                    residentMode: '3',
                    interaction: 'q',
                    cameraFollow: 'w'
                  };
                  setKeyBindings(defaultBindings);
                  localStorage.setItem('keyBindings', JSON.stringify(defaultBindings));
                }}
                style={{
                  marginTop: '10px',
                  padding: '5px 10px',
                  background: 'rgba(150,150,150,0.3)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                デフォルトに戻す
              </button>
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enablePhysics}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  const oldValue = enablePhysics;

                  // オフからオンにしようとしている場合
                  if (!oldValue && newValue) {
                    const confirmed = window.confirm(
                      '物理演算を再度オンにするとOOMエラーが発生する可能性があります。\n' +
                      '物理演算を有効にするには、ページをリロードすることをお勧めします。\n\n' +
                      'リロードしますか？'
                    );
                    if (confirmed) {
                      // localStorageをtrueに変更してからリロード
                      localStorage.setItem('enablePhysics', JSON.stringify(true));
                      window.location.reload();
                    }
                    return; // チェックボックスの状態を変更しない
                  }

                  // オンからオフにする場合は通常通り
                  setEnablePhysics(newValue);
                  localStorage.setItem('enablePhysics', JSON.stringify(newValue));
                }}
                style={{ cursor: 'pointer' }}
              />
              MMD物理演算を有効にする（髪や服の揺れ）
            </label>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
              オフにすると軽量化されますが、揺れものが動きません。OOM発生時は自動でオフになります。
            </p>
            {!enablePhysics && (
              <p style={{ color: 'rgba(255,200,100,0.8)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
                ⚠️ 物理演算をオフにした後、再度オンにするにはページをリロードしてください
              </p>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableSimplePhysics}
                onChange={(e) => {
                  setEnableSimplePhysics(e.target.checked);
                  localStorage.setItem('enableSimplePhysics', JSON.stringify(e.target.checked));
                }}
                style={{ cursor: 'pointer' }}
              />
              簡易物理演算を有効にする（軽量版・実験的）
            </label>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
              Ammo.jsを使わない軽量な物理演算。重力・慣性のみ対応。OOMエラーが発生しません。
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enablePmxAnimation}
                onChange={(e) => {
                  setEnablePmxAnimation(e.target.checked);
                  localStorage.setItem('enablePmxAnimation', JSON.stringify(e.target.checked));
                  // 変更を反映するため、モデルを再読み込み
                  if (window.confirm('設定を反映するにはページをリロードする必要があります。\nリロードしますか？')) {
                    window.location.reload();
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              MMD IK精度モード（膝の位置を改善）
            </label>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
              オンにすると膝の位置が改善されますが、足首が曲がりすぎる場合があります。モデルに応じて調整してください。
            </p>
          </div>

          <h4 style={{ color: '#fff', marginBottom: '10px', marginTop: '15px', fontSize: '14px' }}>ウェイクワード設定</h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              起動ワード（スペース区切りで複数指定可能）
            </label>
            <input
              type="text"
              defaultValue={wakeWords.join(' ')}
              onBlur={(e) => {
                const words = e.target.value.split(/\s+/).map(w => w.trim()).filter(w => w);
                setWakeWords(words);
                localStorage.setItem('wakeWords', JSON.stringify(words));
              }}
              placeholder="ねえアリシア アリシア ヘイアリシア"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px' }}>
              この言葉で連続会話モードが開始されます（スペースで区切って複数指定）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              終了ワード（スペース区切りで複数指定可能）
            </label>
            <input
              type="text"
              defaultValue={endWords.join(' ')}
              onBlur={(e) => {
                const words = e.target.value.split(/\s+/).map(w => w.trim()).filter(w => w);
                setEndWords(words);
                localStorage.setItem('endWords', JSON.stringify(words));
              }}
              placeholder="おっけー ありがとう 終わり バイバイ"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px' }}>
              この言葉で連続会話モードが終了します（スペースで区切って複数指定）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              ウェイクワード応答（スペース区切りで複数指定可能）
            </label>
            <input
              type="text"
              defaultValue={wakeWordResponses.join(' ')}
              onBlur={(e) => {
                const responses = e.target.value.split(/\s+/).map(r => r.trim()).filter(r => r);
                setWakeWordResponses(responses);
                localStorage.setItem('wakeWordResponses', JSON.stringify(responses));
              }}
              placeholder="はーい どうしたの？ なになに？ 呼んだ？ なあに？"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px' }}>
              ウェイクワード検出時にランダムで返事します（スペースで区切って複数指定）
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
              相槌フレーズ（スペース区切りで複数指定可能）
            </label>
            <input
              type="text"
              defaultValue={fillerPhrases.join(' ')}
              onBlur={(e) => {
                const phrases = e.target.value.split(/\s+/).map(p => p.trim()).filter(p => p);
                setFillerPhrases(phrases);
                localStorage.setItem('fillerPhrases', JSON.stringify(phrases));
              }}
              placeholder="なるほど えーっとね んーと そうだね ふむふむ"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px' }}>
              AI応答前にランダムで相槌を入れて待ち時間を短縮します
            </p>
          </div>

          <h4 style={{ color: '#fff', marginBottom: '10px', marginTop: '15px', fontSize: '14px' }}>声紋認証設定</h4>
          <div style={{ marginBottom: '15px' }}>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '10px' }}>
              登録済みサンプル: {voicePrintCount}個
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setShowVoiceRegistration(true);
                  setVoiceRegistrationStep(0);
                }}
                className="ai-init-btn"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '13px',
                  background: voicePrintCount >= 3 ? 'rgba(76, 175, 80, 0.8)' : 'linear-gradient(135deg, #667eea, #764ba2)'
                }}
              >
                {voicePrintCount === 0 ? '音声を登録' : '音声を追加登録'}
              </button>
              {voicePrintCount > 0 && (
                <button
                  onClick={() => {
                    if (confirm('登録済みの音声をすべて削除しますか？')) {
                      voicePrintService.clearVoicePrints();
                      setVoicePrintCount(0);
                    }
                  }}
                  className="ai-init-btn"
                  style={{
                    padding: '10px 20px',
                    fontSize: '13px',
                    background: 'rgba(244, 67, 54, 0.8)'
                  }}
                >
                  クリア
                </button>
              )}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
              あなたの声を3-5回登録してください。登録した声のみウェイクワードに反応します
            </p>
          </div>

          {/* macOSでは全画面アプリの上に表示することはシステム制限により不可能なためコメントアウト
          <h4 style={{ color: '#fff', marginBottom: '10px', marginTop: '15px', fontSize: '14px' }}>常駐モード設定</h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAboveFullscreen}
                onChange={(e) => {
                  setShowAboveFullscreen(e.target.checked);
                  localStorage.setItem('showAboveFullscreen', JSON.stringify(e.target.checked));
                }}
                style={{ cursor: 'pointer' }}
              />
              全画面アプリの上にも表示する（常駐モード時のみ有効）
            </label>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '5px', marginLeft: '24px' }}>
              ゲームや動画の全画面表示の上にもウィンドウを表示します
            </p>
          </div>
          */}

          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={() => {
                if (confirm('会話履歴をクリアしますか？')) {
                  aiService.clearHistory();
                  setChatHistory([]);
                  alert('会話履歴をクリアしました');
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,100,100,0.3)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              会話履歴をクリア
            </button>
          </div>

          {aiStatus === 'not-initialized' && (
            <>
              <button
                onClick={licenseApi.hasValidLicense() ? initializeAI : () => {
                  setShowSettings(false);
                  setAiStatus('skipped'); // ライセンスなしでスキップ
                }}
                className="ai-init-btn"
                style={!licenseApi.hasValidLicense() ? { background: 'rgba(150,150,150,0.3)' } : {}}
              >
                {licenseApi.hasValidLicense() ? 'AIを起動' : '閉じる'}
              </button>
              {licenseApi.hasValidLicense() && (
                <p style={{ fontSize: '11px', marginTop: '10px', color: 'rgba(255,255,255,0.7)' }}>
                  AI: GPT-4.1 mini (OpenAI)
                </p>
              )}
              {aiProgress && <p style={{ color: '#ff6b6b', marginTop: '10px' }}>{aiProgress}</p>}
            </>
          )}
          {showSettings && aiStatus !== 'not-initialized' && (
            <button onClick={() => setShowSettings(false)} className="ai-init-btn" style={{ background: 'rgba(150,150,150,0.3)' }}>
              閉じる
            </button>
          )}
          </div>
        </div>
      )}

      {/* 声質調整モーダル */}
      {showVoiceSettings && (
        <div className="ai-init-overlay">
          <div className="ai-init-panel">
            <div className="ai-init-panel-content">
              <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>
                <i className="fas fa-sliders-h" style={{ marginRight: '10px' }}></i>
                声質調整
              </h3>

              {/* 話速 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#fff', fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                  話速: {voiceSpeedScale.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={voiceSpeedScale}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setVoiceSpeedScale(value);
                    localStorage.setItem('voiceSpeedScale', value.toString());
                  }}
                  style={{
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '4px' }}>
                  <span>遅い (0.5x)</span>
                  <span>標準 (1.0x)</span>
                  <span>速い (2.0x)</span>
                </div>
              </div>

              {/* 音高 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#fff', fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                  音高: {voicePitchScale >= 0 ? '+' : ''}{voicePitchScale.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="-0.15"
                  max="0.15"
                  step="0.01"
                  value={voicePitchScale}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setVoicePitchScale(value);
                    localStorage.setItem('voicePitchScale', value.toString());
                  }}
                  style={{
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '4px' }}>
                  <span>低い (-0.15)</span>
                  <span>標準 (0.0)</span>
                  <span>高い (+0.15)</span>
                </div>
              </div>

              {/* 抑揚 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#fff', fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                  抑揚: {voiceIntonationScale.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={voiceIntonationScale}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setVoiceIntonationScale(value);
                    localStorage.setItem('voiceIntonationScale', value.toString());
                  }}
                  style={{
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '4px' }}>
                  <span>平坦 (0.0)</span>
                  <span>標準 (1.0)</span>
                  <span>豊か (2.0)</span>
                </div>
              </div>

              {/* テスト再生ボタン */}
              <button
                onClick={() => {
                  synthesizeSpeech('声質調整のテストです').catch(error => {
                    console.error('[Test] TTS failed:', error);
                    alert(`テスト再生に失敗しました: ${error.message}`);
                  });
                }}
                className="ai-init-btn"
                style={{ background: 'rgba(100,200,100,0.3)', marginBottom: '10px' }}
              >
                <i className="fas fa-volume-up" style={{ marginRight: '8px' }}></i>
                テスト再生
              </button>

              {/* リセットボタン */}
              <button
                onClick={() => {
                  setVoiceSpeedScale(1.0);
                  setVoicePitchScale(0.0);
                  setVoiceIntonationScale(1.0);
                  localStorage.setItem('voiceSpeedScale', '1.0');
                  localStorage.setItem('voicePitchScale', '0.0');
                  localStorage.setItem('voiceIntonationScale', '1.0');
                }}
                className="ai-init-btn"
                style={{ background: 'rgba(255,150,100,0.3)', marginBottom: '10px' }}
              >
                <i className="fas fa-undo" style={{ marginRight: '8px' }}></i>
                リセット
              </button>

              <button onClick={() => setShowVoiceSettings(false)} className="ai-init-btn" style={{ background: 'rgba(150,150,150,0.3)' }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モデル選択パネル */}
      {/* {showModelSelector && (
        <div className="ai-init-panel">
          <div className="ai-init-panel-content">
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>モデル選択</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                <i className="fas fa-file-import" style={{ marginRight: '8px' }}></i>
                モデルをインポート (.vrm, .zip[MMD])
              </label>
              <input
                type="file"
                accept=".vrm,.zip"
                multiple
                onChange={handleModelImport}
                style={{
                  color: '#fff',
                  padding: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
            </div>

            {/* お気に入りセクション *\/}
            {favoriteModels.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px',
                  padding: '8px',
                  background: 'rgba(251, 191, 36, 0.2)',
                  borderRadius: '4px'
                }}>
                  <i className="fas fa-star" style={{ color: 'rgba(251, 191, 36, 0.9)', marginRight: '8px', fontSize: '14px' }}></i>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>お気に入り</span>
                </div>
                {favoriteModels.map((model, index) => {
                  const modelId = model.imported ? `imported_${model.name}_${model.timestamp}` : model.path || model.name;
                  const isSelected = selectedModel && (
                    selectedModel.imported
                      ? `imported_${selectedModel.name}_${selectedModel.timestamp}` === modelId
                      : (selectedModel.path || selectedModel.name) === modelId
                  );
                  const isFav = isFavoriteModel(model);

                  return (
                    <div
                      key={`fav-model-${modelId}-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        marginBottom: '8px',
                        background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? '2px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <div onClick={() => switchModel(model)} style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontSize: '12px', marginBottom: '2px' }}>{model.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{model.fileType?.toUpperCase() || model.type?.toUpperCase()}</div>
                      </div>
                      <i
                        className={isFav ? "fas fa-star" : "far fa-star"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteModel(model);
                        }}
                        style={{
                          color: isFav ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255,255,255,0.3)',
                          fontSize: '16px',
                          cursor: 'pointer',
                          marginLeft: '10px'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* インポートセクション *\/}
            {importedModels.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px',
                  padding: '8px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  borderRadius: '4px'
                }}>
                  <i className="fas fa-file-import" style={{ color: 'rgba(34, 197, 94, 0.9)', marginRight: '8px', fontSize: '14px' }}></i>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>インポート</span>
                </div>
                {importedModels.map((model, index) => {
                  const modelId = `imported_${model.name}_${model.timestamp}`;
                  const isSelected = selectedModel && selectedModel.imported &&
                    `imported_${selectedModel.name}_${selectedModel.timestamp}` === modelId;
                  const isFav = isFavoriteModel(model);

                  return (
                    <div
                      key={`imported-model-${modelId}-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        marginBottom: '8px',
                        background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? '2px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <div onClick={() => switchModel(model)} style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontSize: '12px', marginBottom: '2px' }}>{model.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{model.fileType?.toUpperCase()}</div>
                      </div>
                      <i
                        className={isFav ? "fas fa-star" : "far fa-star"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteModel(model);
                        }}
                        style={{
                          color: isFav ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255,255,255,0.3)',
                          fontSize: '16px',
                          cursor: 'pointer',
                          marginLeft: '10px'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowModelSelector(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )} */}

      {/* モーションインポートガイド（初回のみ） */}
      {showMotionImportGuide && (
        <div className="ai-init-panel">
          <div className="ai-init-panel-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>モーションのインポートについて</h3>

            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              <p style={{ marginTop: 0, marginBottom: '15px' }}>
                現在、デフォルトでは<strong>4種類のモーション</strong>しか用意されていません。<br/>
                あなたのマスコットを<strong>最大限可愛く</strong>するために、モーションをインポートすることを強くおすすめします！
              </p>

              <div style={{
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#c084fc', marginTop: 0, marginBottom: '8px', fontSize: '13px' }}>
                  <i className="fas fa-heart" style={{ marginRight: '6px' }}></i>
                  モーションを追加すると...
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                  <li style={{ marginBottom: '4px' }}>待機中のポーズがバリエーション豊かに</li>
                  <li style={{ marginBottom: '4px' }}>タップした時の反応がもっと可愛く</li>
                  <li style={{ marginBottom: '4px' }}>撫でた時の嬉しそうな動きが追加</li>
                  <li>自然な動きで、まるで生きているような表現に</li>
                </ul>
              </div>

              <div style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px'
              }}>
                <h4 style={{ color: '#60a5fa', marginTop: 0, marginBottom: '10px', fontSize: '14px' }}>
                  <i className="fas fa-star" style={{ marginRight: '8px' }}></i>
                  おすすめ：音街ウナモーション（商用利用可能・自動認識対応）
                </h4>
                <p style={{ fontSize: '13px', marginBottom: '8px', color: 'rgba(255,255,255,0.8)' }}>
                  高品質で商用利用も可能な、無料のMMDモーションセットです。<br/>
                  <strong style={{ color: '#60a5fa' }}>カテゴリ自動認識機能</strong>に対応しており、インポートするだけで適切なカテゴリに振り分けられます。
                </p>
                <a
                  href="https://otomachiuna.jp/download/download-detail4/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: 'rgba(59, 130, 246, 0.4)',
                    border: '1px solid rgba(59, 130, 246, 0.6)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(59, 130, 246, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(59, 130, 246, 0.4)';
                  }}
                >
                  <i className="fas fa-external-link-alt"></i>
                  ダウンロードページを開く
                </a>
              </div>

              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#a78bfa', marginTop: 0, marginBottom: '8px', fontSize: '13px' }}>
                  <i className="fas fa-cube" style={{ marginRight: '6px' }}></i>
                  その他のモーション：ニコニ立体
                </h4>
                <p style={{ fontSize: '12px', marginBottom: '8px', color: 'rgba(255,255,255,0.8)' }}>
                  様々なクリエイターが配布している豊富なモーションライブラリです。<br/>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>※ これらは自動認識非対応のため、インポート時に手動でカテゴリを指定する必要があります</span>
                </p>
                <a
                  href="https://3d.nicovideo.jp/search?word_type=tag&word=MMD%E3%83%A2%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3&sort=created_at"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(139, 92, 246, 0.3)',
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                    borderRadius: '6px',
                    color: '#a78bfa',
                    fontSize: '12px',
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(139, 92, 246, 0.5)';
                    e.target.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(139, 92, 246, 0.3)';
                    e.target.style.color = '#a78bfa';
                  }}
                >
                  <i className="fas fa-external-link-alt"></i>
                  ニコニ立体で探す
                </a>
              </div>

              <h4 style={{ color: '#fff', fontSize: '13px', marginBottom: '10px' }}>
                <i className="fas fa-download" style={{ marginRight: '8px', color: '#60a5fa' }}></i>
                インポート方法
              </h4>
              <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
                <li style={{ marginBottom: '8px' }}>ダウンロードしたZIPファイルを<strong>展開せずそのまま</strong>使用</li>
                <li style={{ marginBottom: '8px' }}>ヘッダー左上の<strong>人アイコン</strong>をクリックしてモーション選択画面を開く</li>
                <li style={{ marginBottom: '8px' }}>右上の「インポート」ボタンからファイルを選択</li>
                <li>自動的にカテゴリが認識され、すぐに使えます！</li>
              </ol>

              <h4 style={{ color: '#fff', fontSize: '13px', marginBottom: '10px' }}>
                <i className="fas fa-magic" style={{ marginRight: '8px', color: '#c084fc' }}></i>
                自動認識機能（音街ウナモーションのみ）
              </h4>
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.8)'
              }}>
                <p style={{ margin: 0, marginBottom: '8px' }}>音街ウナモーションは、自動的に以下のカテゴリに分類されます：</p>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li><strong style={{ color: '#86efac' }}>Primary</strong>：待機ループモーション（自動で繰り返し再生）</li>
                  <li><strong style={{ color: '#c084fc' }}>Variants</strong>：バリエーションモーション（ランダムに切り替わる）</li>
                  <li><strong style={{ color: '#60a5fa' }}>Tap</strong>：タップ時のリアクション</li>
                  <li><strong style={{ color: '#f9a8d4' }}>Pet</strong>：撫でる時のモーション</li>
                </ul>
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                  ※ その他のモーションは、インポート時に手動でカテゴリを選択してください
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  localStorage.setItem('hasSeenMotionImportGuide', 'true');
                  setShowMotionImportGuide(false);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                後で
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('hasSeenMotionImportGuide', 'true');
                  setShowMotionImportGuide(false);
                  setShowMotionSelector(true);
                }}
                className="ai-init-btn"
                style={{ flex: 1 }}
              >
                今すぐインポート
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モーション選択パネル */}
      {showMotionSelector && (
        <div className="ai-init-panel">
          <div className="ai-init-panel-content">
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>モーション選択</h3>

            {/* 音街ウナモーション推奨ガイド */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '15px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <i className="fas fa-info-circle" style={{ color: '#3b82f6' }}></i>
                <h4 style={{ color: '#fff', margin: 0, fontSize: '13px' }}>推奨モーション</h4>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                <strong>音街ウナモーション</strong>（商用利用可能）
              </p>
              <a
                href="https://otomachiuna.jp/download/download-detail4/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: 'rgba(59, 130, 246, 0.3)',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '4px',
                  color: '#60a5fa',
                  fontSize: '10px',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.5)';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.3)';
                  e.target.style.color = '#60a5fa';
                }}
              >
                <i className="fas fa-external-link-alt"></i>
                ダウンロードページを開く
              </a>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', margin: '8px 0 0 0' }}>
                ※インポート時に自動で適切なカテゴリに振り分けられます
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ color: '#fff', margin: 0, fontSize: '14px' }}>モーション一覧</h4>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".zip,.vmd"
                    multiple
                    onChange={handleMotionImport}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    padding: '4px 12px',
                    background: 'rgba(59, 130, 246, 0.3)',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(59, 130, 246, 0.5)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(59, 130, 246, 0.3)'}
                  >
                    <i className="fas fa-file-import"></i>
                    インポート
                  </div>
                </label>
              </div>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '10px'
              }}>
                {/* お気に入りモーションセクション */}
                {favoriteMotions.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{
                      color: 'rgba(251, 191, 36, 0.9)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <i className="fas fa-star"></i>
                      お気に入り
                    </div>
                    {favoriteMotions.map((motion, index) => {
                      const displayName = motion.name || motion.url?.split('/').pop().replace('.vmd', '');
                      const isSelected = selectedMotionData === motion || (selectedMotionData?.url === motion.url && !motion.imported);
                      return (
                        <div
                          key={`fav-${index}`}
                          style={{
                            padding: '8px',
                            marginBottom: '5px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                        >
                          <div onClick={() => setSelectedMotionData(motion)} style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontSize: '12px', marginBottom: '2px' }}>{displayName}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                              {motion.imported ? motion.fileType?.toUpperCase() : motion.type}
                            </div>
                          </div>
                          <i
                            className="fas fa-star"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(motion);
                            }}
                            style={{
                              color: 'rgba(251, 191, 36, 0.9)',
                              cursor: 'pointer',
                              fontSize: '14px',
                              padding: '4px'
                            }}
                          ></i>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* インポートモーションセクション */}
                {importedMotions.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{
                      color: 'rgba(34, 197, 94, 0.8)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fas fa-file-import"></i>
                        インポートモーション
                      </div>
                      <button
                        onClick={() => setIsEditingImportedMotions(!isEditingImportedMotions)}
                        style={{
                          background: isEditingImportedMotions ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.1)',
                          border: '1px solid ' + (isEditingImportedMotions ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.2)'),
                          borderRadius: '4px',
                          color: isEditingImportedMotions ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          padding: '3px 8px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isEditingImportedMotions) {
                            e.target.style.background = 'rgba(255,255,255,0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isEditingImportedMotions) {
                            e.target.style.background = 'rgba(255,255,255,0.1)';
                          }
                        }}
                      >
                        {isEditingImportedMotions ? '完了' : '編集'}
                      </button>
                    </div>
                    {importedMotions.map((motion, index) => {
                      const displayName = motion.name;
                      const isSelected = selectedMotionData === motion;
                      const isFav = isFavorite(motion);
                      return (
                        <div
                          key={`imported-${index}`}
                          style={{
                            padding: '8px',
                            marginBottom: '5px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                        >
                          <div onClick={() => setSelectedMotionData(motion)} style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontSize: '12px', marginBottom: '2px' }}>{displayName}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                              {motion.category === 'primary' ? 'Primary' :
                               motion.category === 'variants' ? 'Variant' :
                               motion.category === 'tap' ? 'Tap' :
                               motion.category === 'pet' ? 'Pet' :
                               'Other'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <i
                              className={isFav ? "fas fa-star" : "far fa-star"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(motion);
                              }}
                              style={{
                                color: isFav ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255,255,255,0.3)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '4px'
                              }}
                            ></i>
                            {isEditingImportedMotions && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteImportedMotion(motion);
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid rgba(239, 68, 68, 0.5)',
                                  borderRadius: '4px',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '4px 8px',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.background = 'rgba(239, 68, 68, 0.4)';
                                  e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                                  e.target.style.color = '#f87171';
                                }}
                              >
                                削除
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* デフォルトモーションセクション */}
                <div>
                  <div style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    paddingLeft: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <i className="fas fa-folder"></i>
                    デフォルトモーション
                  </div>
                  {(() => {
                    const baseMotions = (mmdAllAnimationsRef.current || []).filter(motion => !motion.imported);
                    return baseMotions.map((motion, index) => {
                      const displayName = motion.name || motion.url.split('/').pop().replace('.vmd', '');
                      const isSelected = selectedMotionData?.url === motion.url && !selectedMotionData?.imported;
                      const isFav = isFavorite(motion);
                      return (
                        <div
                          key={`default-${index}`}
                          style={{
                            padding: '8px',
                            marginBottom: '5px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                        >
                          <div onClick={() => setSelectedMotionData(motion)} style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontSize: '12px', marginBottom: '2px' }}>{displayName}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{motion.type}</div>
                          </div>
                          <i
                            className={isFav ? "fas fa-star" : "far fa-star"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(motion);
                            }}
                            style={{
                              color: isFav ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255,255,255,0.3)',
                              cursor: 'pointer',
                              fontSize: '14px',
                              padding: '4px'
                            }}
                          ></i>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>ループ設定</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '12px', marginBottom: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isInfiniteLoop}
                  onChange={(e) => setIsInfiniteLoop(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                無限ループ
              </label>
              {!isInfiniteLoop && (
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ color: '#fff', fontSize: '12px', marginBottom: '5px', display: 'block' }}>
                    ループ回数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={manualLoopCount}
                    onChange={(e) => setManualLoopCount(parseInt(e.target.value) || 1)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (selectedMotionData) {
                  const loops = isInfiniteLoop ? 'infinite' : manualLoopCount;
                  playManualMotion(selectedMotionData, loops);
                  setShowMotionSelector(false);
                }
              }}
              className="ai-init-btn"
              disabled={!selectedMotionData}
              style={{
                opacity: selectedMotionData ? 1 : 0.5,
                cursor: selectedMotionData ? 'pointer' : 'not-allowed'
              }}
            >
              再生
            </button>

            <button
              onClick={() => setShowMotionSelector(false)}
              className="ai-init-btn"
              style={{ background: 'rgba(150,150,150,0.3)', marginTop: '10px' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 連続会話モード継続確認ダイアログ */}
      {showConversationConfirm && (
        <div className="ai-init-panel" style={{ zIndex: 2000 }}>
          <div className="ai-init-panel-content">
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>連続会話モード</h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginBottom: '20px' }}>
              連続会話モードが20分経過しました。<br/>
              このまま継続しますか？
            </p>
            <button
              onClick={() => {
                // タイマーをリセットして継続
                if (conversationTimer) clearTimeout(conversationTimer);
                const timer = setTimeout(() => {
                  setShowConversationConfirm(true);
                }, 20 * 60 * 1000); // 20分
                setConversationTimer(timer);
                setShowConversationConfirm(false);
              }}
              className="ai-init-btn"
              style={{ marginBottom: '10px' }}
            >
              継続する
            </button>
            <button
              onClick={() => {
                // 連続会話モード終了
                isConversationModeRef.current = false;
              setIsConversationMode(false);
                if (conversationTimer) {
                  clearTimeout(conversationTimer);
                  setConversationTimer(null);
                }
                setShowConversationConfirm(false);
              }}
              className="ai-init-btn"
              style={{ background: 'rgba(255,100,100,0.3)' }}
            >
              終了する
            </button>
          </div>
        </div>
      )}

      {/* 音声登録モーダル */}
      {showVoiceRegistration && (
        <div className="ai-init-panel" style={{ zIndex: 2000 }}>
          <div className="ai-init-panel-content">
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>
              {voiceRegistrationStep === 0 ? '音声登録' : `音声サンプル ${voiceRegistrationStep}/3`}
            </h3>

            {voiceRegistrationStep === 0 ? (
              // 説明画面
              <>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginBottom: '15px', lineHeight: '1.6' }}>
                  あなたの声を登録します。<br/>
                  <br/>
                  次の画面で、5秒間好きな言葉を話してください。<br/>
                  これを3回繰り返します。<br/>
                  <br/>
                  登録後は、あなたの声のみウェイクワードに反応するようになります。
                </p>
                <button
                  onClick={() => setVoiceRegistrationStep(1)}
                  className="ai-init-btn"
                  style={{ marginBottom: '10px' }}
                >
                  開始
                </button>
                <button
                  onClick={() => {
                    setShowVoiceRegistration(false);
                    setVoiceRegistrationStep(0);
                  }}
                  className="ai-init-btn"
                  style={{ background: 'rgba(128,128,128,0.5)' }}
                >
                  キャンセル
                </button>
              </>
            ) : (
              // 録音画面
              <>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginBottom: '20px' }}>
                  {isVoiceRecordingForPrint ? (
                    <>
                      <span style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }}><i className="fas fa-microphone"></i></span>
                      録音中...（5秒）
                    </>
                  ) : (
                    <>録音ボタンを押して、5秒間話してください</>
                  )}
                </p>
                <button
                  onClick={recordVoiceForPrint}
                  disabled={isVoiceRecordingForPrint}
                  className="ai-init-btn"
                  style={{
                    marginBottom: '10px',
                    opacity: isVoiceRecordingForPrint ? 0.5 : 1,
                    cursor: isVoiceRecordingForPrint ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isVoiceRecordingForPrint ? '録音中...' : '録音開始'}
                </button>
                <button
                  onClick={() => {
                    setShowVoiceRegistration(false);
                    setVoiceRegistrationStep(0);
                  }}
                  disabled={isVoiceRecordingForPrint}
                  className="ai-init-btn"
                  style={{
                    background: 'rgba(128,128,128,0.5)',
                    opacity: isVoiceRecordingForPrint ? 0.5 : 1,
                    cursor: isVoiceRecordingForPrint ? 'not-allowed' : 'pointer'
                  }}
                >
                  キャンセル
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI読み込み中 */}
      {aiStatus === 'loading' && (
        <div className="ai-loading-panel">
          <div className="loading-spinner"></div>
          <p>{aiProgress}</p>
        </div>
      )}

      
      {/* モーションコントロールパネル（一時的に無効化） */}
      {false && motionControls && (
        <div className="motion-controls">
          <button onClick={() => motionControls.wave()}>手を振る</button>
          <button onClick={() => motionControls.nod()}>うなずく</button>
          <button onClick={() => motionControls.jump()}>ジャンプ</button>
          <button onClick={() => motionControls.dance()}>ダンス</button>
          <button onClick={() => setEnableMouseFollow(!enableMouseFollow)}>
            マウス追従: {enableMouseFollow ? 'ON' : 'OFF'}
          </button>
        </div>
      )}
      {showModelTypeDialog && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#222', padding: '20px', borderRadius: '12px', width: '360px', maxHeight: '80vh', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', fontSize: '13px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ overflowY: 'auto', flex: 1 }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>モデルタイプの選択</h3>
            <p style={{ lineHeight: 1.4, wordBreak: 'break-all' }}>
              {pendingModelName ? `ファイル: ${pendingModelName}` : 'ファイル'}<br/>
              推定タイプ: <strong>{suggestedType === 'vrm' ? 'VRM' : 'MMD (PMX/PMD)'}</strong>
            </p>
            {suggestedType === 'mmd' && (
              <p style={{ fontSize: '11px', opacity: 0.8 }}>
                PMX/PMD でテクスチャが見つからない場合は、モデルと同じフォルダ内の Texture / Toon / Sphere などの画像ファイルを Shift+クリックでまとめて選択するか、フォルダごと ZIP にまとめて読み込んでください。
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => confirmModelType('vrm')} style={buttonStyle(suggestedType==='vrm')}>VRMとして読み込む</button>
              <button onClick={() => confirmModelType('mmd')} style={buttonStyle(suggestedType==='mmd')}>MMD(PMX/PMD)として読み込む</button>
              <button onClick={cancelModelSelect} style={cancelButtonStyle}>キャンセル</button>
            </div>
            </div>
          </div>
        </div>
      )}

      {!isResidentMode && (
        <div className="chat-container">
          <div className="chat-history">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <span>{msg.content}</span>
              </div>
            ))}
          </div>

          <div className="chat-input">
          {capturedImage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px',
              padding: '8px',
              background: 'rgba(156, 39, 176, 0.1)',
              borderRadius: '4px',
              border: '1px solid rgba(156, 39, 176, 0.3)'
            }}>
              <img
                src={`data:image/png;base64,${capturedImage}`}
                alt="Captured"
                style={{
                  width: '50px',
                  height: '50px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  marginRight: '8px'
                }}
              />
              <span style={{ flex: 1, fontSize: '14px', color: '#9C27B0' }}>
                📸 スクリーンショットを添付
              </span>
              <button
                onClick={() => setCapturedImage(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9C27B0',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px 8px'
                }}
                title="画像を削除"
              >
                ×
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="メッセージを入力..."
          />
          <button
            onClick={toggleConversationMode}
            style={{
              background: isConversationMode ? '#ff9800' : '#2196F3',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '5px'
            }}
          >
            {isConversationMode ? '会話終了' : '連続会話'}
          </button>
          <button
            onClick={handleVoiceRecord}
            style={{
              background: isRecording ? '#ff4444' : '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '5px'
            }}
            disabled={isConversationMode}
          >
            {isRecording ? '停止' : '録音'}
          </button>
          <button
            onClick={handleScreenCapture}
            disabled={isCapturing || aiStatus !== 'ready'}
            style={{
              background: isCapturing ? '#FF9800' : (capturedImage ? '#4CAF50' : '#9C27B0'),
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '4px',
              cursor: (isCapturing || aiStatus !== 'ready') ? 'not-allowed' : 'pointer',
              marginRight: '5px',
              opacity: (isCapturing || aiStatus !== 'ready') ? 0.5 : 1
            }}
            title={capturedImage ? 'スクショ済み（クリックで再撮影）' : 'スクリーンショットを撮る'}
          >
            <i className="fas fa-camera"></i>
          </button>
          <button onClick={handleSendMessage}>送信</button>
        </div>

        <div className="file-input">
          <button
            onClick={() => setShowModelSourceModal(true)}
            style={{
              background: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            モデルファイル選択
          </button>
          <input
            id="model-file"
            ref={fileInputRef => window.modelFileInput = fileInputRef}
            type="file"
            accept=".vrm,.pmx,.pmd,.zip"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      )}

        {/* 常駐モード時のミニマルUI */}
        {isResidentMode && (
          <div
            className="resident-controls"
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '10px',
              display: 'flex',
              gap: '8px',
              pointerEvents: 'auto'
            }}
            onMouseEnter={() => window.electronAPI?.toggleClickThrough(false)}
            onMouseLeave={() => window.electronAPI?.toggleClickThrough(true)}
          >
            <button
              onClick={toggleConversationMode}
              style={{
                background: isConversationMode ? '#ff9800' : '#2196F3',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '16px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
              data-tooltip={isConversationMode ? '会話終了' : '連続会話'}
            >
              {isConversationMode ? <i className="fas fa-pause"></i> : <i className="fas fa-microphone"></i>}
            </button>
            <button
              onClick={() => setShowResidentChat(prev => !prev)}
              style={{
                background: showResidentChat ? '#4CAF50' : '#757575',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '16px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
              data-tooltip={showResidentChat ? 'チャット非表示' : 'チャット表示'}
            >
              {showResidentChat ? <i className="fas fa-times"></i> : <i className="fas fa-comment"></i>}
            </button>
            <button
              onClick={handleScreenCapture}
              disabled={isCapturing || aiStatus !== 'ready'}
              style={{
                background: isCapturing ? '#FF9800' : '#9C27B0',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '50%',
                cursor: (isCapturing || aiStatus !== 'ready') ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                opacity: (isCapturing || aiStatus !== 'ready') ? 0.5 : 1
              }}
              data-tooltip={isCapturing ? 'キャプチャ中...' : '画面をキャプチャ'}
            >
              <i className="fas fa-camera"></i>
            </button>
            <div
              className={`resident-indicator ${(isTyping || isSpeaking) ? 'loading' : ''}`}
              style={{
                background: (isTyping || isSpeaking) ? '#FF9800' : 'rgba(100, 100, 100, 0.5)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '50%',
                cursor: 'default',
                fontSize: '16px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                position: 'relative'
              }}
              data-tooltip={(isTyping || isSpeaking) ? '処理中...' : '待機中'}
            >
              {(isTyping || isSpeaking) ? (
                <div className="spinner"></div>
              ) : (
                '○'
              )}
            </div>
          </div>
        )}

        {/* 常駐モード時のLINE風チャットボックス */}
        {isResidentMode && showResidentChat && (
          <div
            className="resident-chat-box"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '20px',
              zIndex: -1,
              pointerEvents: 'none'
            }}
          >
            {/* チャット履歴 */}
            <div
              ref={residentChatContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                marginBottom: '0',
                pointerEvents: 'none'
              }}
            >
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '10px 15px',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: msg.role === 'user' ? 'rgba(0, 132, 255, 0.8)' : msg.role === 'system' ? 'rgba(228, 230, 235, 0.8)' : 'rgba(240, 240, 240, 0.8)',
                      color: msg.role === 'user' ? 'white' : '#333',
                      fontSize: '14px',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      backdropFilter: 'blur(5px)'
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={residentChatEndRef} />
            </div>

          </div>
        )}

      {/* ライセンスモーダル */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        onLicenseActivated={(info) => {
          setLicenseInfo(info);
          if (info) {
            // ライセンス追加時: 初回起動時以外ならAIを起動
            if (aiStatus !== 'not-initialized') {
              initializeAI();
            }
          } else {
            // ライセンス削除時: AI接続を解除
            if (aiStatus === 'ready') {
              aiService.destroy();
              setAiStatus('skipped');
              setChatHistory([]);
            }
          }
        }}
      />

      {/* 利用規約同意モーダル */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        onAccept={() => setIsConsentModalOpen(false)}
      />

      {/* About モーダル */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      {/* モデル読み込み元選択モーダル */}
      {showModelSourceModal && (
        <div className="modal-overlay" onClick={() => setShowModelSourceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3>モデル読み込み</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => {
                  setShowModelSourceModal(false);
                  window.modelFileInput?.click();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 15px',
                  background: 'rgba(33, 150, 243, 0.1)',
                  border: '1px solid rgba(33, 150, 243, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(33, 150, 243, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(33, 150, 243, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(33, 150, 243, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(33, 150, 243, 0.3)';
                }}
              >
                <i className="fas fa-folder-open" style={{ fontSize: '20px', color: '#2196F3', minWidth: '20px' }}></i>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>ローカルファイル</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>VRM/PMX/PMDファイルを選択</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowModelSourceModal(false);
                  setShowVRoidPicker(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 15px',
                  background: 'rgba(156, 39, 176, 0.1)',
                  border: '1px solid rgba(156, 39, 176, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(156, 39, 176, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(156, 39, 176, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(156, 39, 176, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(156, 39, 176, 0.3)';
                }}
              >
                <i className="fas fa-cloud" style={{ fontSize: '20px', color: '#9C27B0', minWidth: '20px' }}></i>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>VRoid Hub</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>オンラインからキャラクターを選択</div>
                </div>
              </button>
            </div>
            <button onClick={() => setShowModelSourceModal(false)} style={{ marginTop: '15px', width: '100%' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* VRoid Hub モデル選択 */}
      {showVRoidPicker && (
        <VRoidModelPicker
          onSelect={(model) => {
            console.log('[App] VRoid model selected:', model);
            // VRMファイルのURLを使ってモデルを読み込み
            setModelUrl(model.url);
            setModelType('vrm');
            setShowVRoidPicker(false);
          }}
          onClose={() => setShowVRoidPicker(false)}
        />
      )}
      </div>
  );
}

export default App;
