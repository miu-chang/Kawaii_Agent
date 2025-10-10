import { clamp } from '../utils/math';

const MOTION_LIBRARY = {
  dwarf_idle: {
    file: './animations/Dwarf Idle.vrma',
    loop: true,
    emotion: 'neutral',
    description: '呼吸だけの静かな待機'
  },
  dwarf_idle_alt: {
    file: './animations/Dwarf Idle-2.vrma',
    loop: true,
    emotion: 'neutral',
    description: '別パターンの呼吸待機'
  },
  idle_soft: {
    file: './animations/idle_01.vrma',
    loop: true,
    emotion: 'neutral',
    description: '穏やかな待機モーション'
  },
  idle_lively: {
    file: './animations/idle_02.vrma',
    loop: true,
    emotion: 'happy',
    description: '少し動きのあるアイドル'
  },
  idle_sway: {
    file: './animations/happy_idle.vrma',
    loop: true,
    emotion: 'neutral',
    description: '柔らかく揺れる待機'
  },
  idle_sway_alt: {
    file: './animations/look_around.vrma',
    loop: true,
    emotion: 'neutral',
    description: '周囲を見回す待機'
  },
  idle_cheerful: {
    file: './animations/standing_greeting.vrma',
    loop: true,
    emotion: 'happy',
    description: '柔らかな挨拶を織り交ぜた待機'
  },
  idle_sleepy: {
    file: './animations/sleeping_idle.vrma',
    loop: true,
    emotion: 'neutral',
    description: '眠そうに揺れる待機'
  },
  idle_look_right: {
    file: './animations/looking_right.vrma',
    loop: true,
    emotion: 'thinking',
    description: '首を傾け視線を送る待機'
  },
  idle_walk_loop: {
    file: './animations/walk.vrma',
    loop: true,
    emotion: 'neutral',
    description: '小刻みな足踏み'
  },
  wave: {
    file: './animations/wave.vrma',
    loop: false,
    emotion: 'happy',
    description: '片手を振って挨拶'
  },
  wave_big: {
    file: './animations/wave_02.vrma',
    loop: false,
    emotion: 'surprised',
    description: '大きく手を振る挨拶'
  },
  clap: {
    file: './animations/clap.vrma',
    loop: false,
    emotion: 'happy',
    description: '喜びの拍手'
  },
  thinking: {
    file: './animations/thinking.vrma',
    loop: false,
    emotion: 'thinking',
    description: '考え込むジェスチャー'
  },
  looking_files: {
    file: './animations/looking_through_files_low.vrma',
    loop: false,
    emotion: 'thinking',
    description: '資料を覗き込む動き'
  },
  joy: {
    file: './animations/joy.vrma',
    loop: false,
    emotion: 'happy',
    description: '喜びのジャンプ'
  },
  joyful_jump: {
    file: './animations/joy.vrma',
    loop: false,
    emotion: 'happy',
    description: '弾けるジャンプ'
  },
  excited: {
    file: './animations/excited.vrma',
    loop: false,
    emotion: 'happy',
    description: 'テンションが高い動き'
  },
  excited_alt: {
    file: './animations/clap_02.vrma',
    loop: false,
    emotion: 'happy',
    description: '喜びを強調する手拍子'
  },
  sad: {
    file: './animations/crying.vrma',
    loop: false,
    emotion: 'sad',
    description: '肩を震わせる泣き'
  },
  surprised: {
    file: './animations/look_around.vrma',
    loop: false,
    emotion: 'surprised',
    description: '周囲を見回す驚きの動き'
  },
  typing: {
    file: './animations/typing.vrma',
    loop: true,
    emotion: 'neutral',
    description: 'タイピング動作'
  },
  typing_alt: {
    file: './animations/typing.vrma',
    loop: true,
    emotion: 'neutral',
    description: '別パターンのタイピング'
  },
  walk: {
    file: './animations/walk.vrma',
    loop: true,
    emotion: 'neutral',
    description: '足取りのある待機'
  },
  walking_turn: {
    file: './animations/turn.vrma',
    loop: true,
    emotion: 'neutral',
    description: 'ゆったりターンのある足踏み'
  },
  happy_walk: {
    file: './animations/happy_walk.vrma',
    loop: true,
    emotion: 'happy',
    description: '軽快なステップ'
  },
  happy_walk_alt: {
    file: './animations/look_behind_run.vrma',
    loop: true,
    emotion: 'happy',
    description: '振り返りながらの軽快なステップ'
  },
  standing_greeting: {
    file: './animations/standing_greeting.vrma',
    loop: false,
    emotion: 'happy',
    description: '軽くお辞儀する挨拶'
  },
  clap_02: {
    file: './animations/standing_clap_alt.vrma',
    loop: false,
    emotion: 'happy',
    description: '別パターンの拍手'
  },
  getting_up: {
    file: './animations/getting_up.vrma',
    loop: false,
    emotion: 'neutral',
    description: '起き上がる動作'
  },
  laying_sleeping: {
    file: './animations/laying_sleeping.vrma',
    loop: true,
    emotion: 'neutral',
    description: '横たわって眠る'
  },
  swimming: {
    file: './animations/swimming_to_edge.vrma',
    loop: false,
    emotion: 'neutral',
    description: '泳ぐ動作'
  },
  drunk_walk: {
    file: './animations/drunk_walk.vrma',
    loop: true,
    emotion: 'neutral',
    description: 'ふらふら歩く'
  },
  drunk_turn: {
    file: './animations/drunk_walking_turn.vrma',
    loop: true,
    emotion: 'neutral',
    description: 'ふらふら歩いて振り返る'
  },
  look_around_alt: {
    file: './animations/look_around_alt.vrma',
    loop: true,
    emotion: 'thinking',
    description: '別パターンで周囲を見回す'
  },
  thinking_alt: {
    file: './animations/thinking_alt.vrma',
    loop: false,
    emotion: 'thinking',
    description: '別パターンで考える'
  },
  singing: {
    file: './animations/singing.vrma',
    loop: true,
    emotion: 'happy',
    description: '歌う'
  },
  singing_alt: {
    file: './animations/singing_alt.vrma',
    loop: true,
    emotion: 'happy',
    description: '別パターンで歌う'
  },
  turn_alt: {
    file: './animations/turning_alt.vrma',
    loop: true,
    emotion: 'neutral',
    description: '別パターンでターン'
  },
  walk_alt: {
    file: './animations/walking_alt.vrma',
    loop: true,
    emotion: 'neutral',
    description: '別パターンで歩く'
  },
  wave_alt: {
    file: './animations/waving_alt.vrma',
    loop: false,
    emotion: 'happy',
    description: '別パターンで手を振る'
  },
  looking_files_alt: {
    file: './animations/looking_files_low.vrma',
    loop: false,
    emotion: 'thinking',
    description: '別パターンで資料を見る'
  }
};

const KNOWN_EMOTIONS = ['happy', 'sad', 'angry', 'surprised', 'thinking', 'neutral'];

// 解析用プロンプト
const SYSTEM_PROMPT = `あなたはデスクトップアバターの演出ディレクターです。
ユーザーとの会話内容を受け取り、次のアクションをJSONで返してください。

必ず以下の形式で出力してください（1つの感情、1つのモーション、1つの数値を選択）：
{
  "emotion": "happy",
  "motion": "idle_cheerful",
  "loop": true,
  "intensity": 0.6
}

emotionは次から1つ選択: happy, sad, angry, surprised, thinking, neutral
motionは次から1つ選択: ${Object.keys(MOTION_LIBRARY).slice(0, 15).join(', ')}など
loopはtrueまたはfalse
intensityは0.0から1.0の数値（小数）

intensityの目安：
- 0.2-0.4: 穏やかな感情
- 0.5-0.7: 通常の感情
- 0.8-1.0: 強い感情

説明文は不要です。有効なJSONのみ出力してください。範囲指定（0.3-0.5など）ではなく、具体的な数値（0.4など）を指定してください。`;

const DEFAULT_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

async function loadWebLLM() {
  return import('@mlc-ai/web-llm');
}

function extractJSON(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.warn('Failed to parse JSON from local AI output:', text);
    return null;
  }
}

function fallbackHeuristics(responseText = '') {
  const lower = responseText.toLowerCase();
  if (lower.includes('ありがとう') || lower.includes('嬉しい') || lower.includes('楽しい')) {
    return { emotion: 'happy', motion: 'idle_cheerful', loop: true, intensity: 0.7 };
  }
  if (lower.includes('考え') || lower.includes('どうしよう') || lower.includes('むずかしい')) {
    return { emotion: 'thinking', motion: 'idle_look_right', loop: true, intensity: 0.5 };
  }
  if (lower.includes('ごめん') || lower.includes('申し訳') || lower.includes('悲しい')) {
    return { emotion: 'sad', motion: 'idle_sleepy', loop: true, intensity: 0.4 };
  }
  if (lower.includes('びっくり') || lower.includes('驚') || lower.includes('えっ')) {
    return { emotion: 'surprised', motion: 'surprised', loop: false, intensity: 0.6 };
  }
  return { emotion: 'neutral', motion: 'idle_sway_alt', loop: true, intensity: 0.3 };
}

class LocalMotionAI {
  constructor() {
    this.enginePromise = null;
    this.lastSuggestion = { emotion: null, motion: null };
  }

  async initialize() {
    if (!this.enginePromise) {
      this.enginePromise = (async () => {
        const webllm = await loadWebLLM();
        const factory = webllm.CreateMLCEngine ?? webllm.createMLCEngine;
        if (!factory) {
          throw new Error('CreateMLCEngine not found in @mlc-ai/web-llm');
        }

        const availableModels = webllm.prebuiltAppConfig?.model_list ?? [];
        let chosenModelId = DEFAULT_MODEL_ID;
        const hasPreferred = availableModels.some((model) => model.model_id === chosenModelId);
        if (!hasPreferred) {
          console.warn('[LocalMotionAI] Preferred model not found, falling back to first available model');
          chosenModelId = availableModels[0]?.model_id || DEFAULT_MODEL_ID;
        }

        console.log('[LocalMotionAI] loading model:', chosenModelId);
        const engine = await factory(
          chosenModelId,
          { appConfig: webllm.prebuiltAppConfig }
        );
        return engine;
      })();
    }
    return this.enginePromise;
  }

  async suggest({ conversation = [], responseText = '', lastEmotion = 'neutral' } = {}) {
    try {
      const engine = await this.initialize();
      if (!engine?.chat?.completions?.create) {
        console.warn('[LocalMotionAI] chat.completions.create not found, attempting legacy chatCompletion API');
      }
      // 前回の提案を含める
      let promptText = `最新のアシスタントの返答:\n${responseText}\n\nこれまでの会話要約:\n${conversation.map(item => `${item.role}: ${item.content}`).join('\n')}`;

      if (this.lastSuggestion.emotion && this.lastSuggestion.motion) {
        promptText += `\n\n前回の提案: emotion="${this.lastSuggestion.emotion}", motion="${this.lastSuggestion.motion}"\n同じものを避けて、異なる表情やモーションを選んでください。バリエーションを持たせてください。`;
      }

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: promptText
        }
      ];

      let content = '';
      if (engine.chat?.completions?.create) {
        const completion = await engine.chat.completions.create({
          messages,
          temperature: 0.85,
          stream: false
        });
        content = completion?.choices?.[0]?.message?.content || '';
      } else if (engine.chatCompletion) {
        // Fallback to older API
        const completion = await engine.chatCompletion({
          messages,
          temperature: 0.85,
          stream: false
        });
        content = completion?.choices?.[0]?.message?.content || '';
      } else {
        throw new Error('No valid chat completion API on engine');
      }
      const parsed = extractJSON(content);
      if (!parsed) {
        return fallbackHeuristics(responseText);
      }

      const emotion = KNOWN_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : lastEmotion;
      const motion = MOTION_LIBRARY[parsed.motion] ? parsed.motion : 'dwarf_idle';
      const loop = typeof parsed.loop === 'boolean' ? parsed.loop : MOTION_LIBRARY[motion].loop;
      const intensity = clamp(Number(parsed.intensity ?? 0.5), 0, 1);

      // 今回の提案を記録
      this.lastSuggestion = { emotion, motion };

      return { emotion, motion, loop, intensity };
    } catch (error) {
      console.error('LocalMotionAI failed, fallback heuristics:', error?.stack || error);
      this.enginePromise = null;
      return fallbackHeuristics(responseText);
    }
  }
}

const instance = new LocalMotionAI();
export { MOTION_LIBRARY };
export default instance;
