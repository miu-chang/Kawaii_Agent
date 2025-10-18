import OpenAI from 'openai';
import licenseApi from './licenseApi';

class AIService {
  constructor() {
    this.openai = null;
    this.isReady = false;
    this.conversationHistory = [];
    this.maxHistoryLength = 20; // 最大20件の会話を記憶
    this.systemPrompt = ''; // 初期化時に設定
    this.model = 'gpt-4.1-mini';
    this.isLicenseMode = false; // ライセンスモードかどうか
    this.expressionHistory = []; // 表情選択履歴（直近5回分）
    this.maxExpressionHistory = 5;
  }

  async initialize(apiKey, systemPrompt, onProgress) {
    if (this.isReady) return;

    try {
      if (onProgress) {
        onProgress({ text: 'AIサービスに接続中...' });
      }

      // ライセンスモードチェック
      this.isLicenseMode = (apiKey === 'license-mode' || !apiKey);

      if (!this.isLicenseMode) {
        // OpenAI APIを直接使用
        this.openai = new OpenAI({
          apiKey: apiKey,
          dangerouslyAllowBrowser: true
        });
      }

      // システムプロンプトを設定
      this.systemPrompt = systemPrompt || 'あなたは可愛いデスクトップアシスタントです。';

      this.isReady = true;
      console.log('AI Service ready!');
      console.log('License Mode:', this.isLicenseMode);
      console.log('Model:', this.model);
      console.log('System Prompt:', this.systemPrompt);

      // ローカルストレージから会話履歴を復元
      this.loadConversationHistory();

    } catch (error) {
      console.error('Failed to initialize AI:', error);
      throw error;
    }
  }

  async chat(message, onStream, options = {}) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      const {
        model = this.model,
        temperature = undefined,
        systemPrompt = this.systemPrompt,
        saveToHistory = true
      } = options;

      // 会話履歴に追加
      if (saveToHistory) {
        this.conversationHistory.push({
          role: 'user',
          content: message
        });

        // 履歴が長すぎる場合は古いものを削除
        if (this.conversationHistory.length > this.maxHistoryLength) {
          this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
      }

      // input配列を構築（instructionsで分離しない、messagesと互換性のため）
      const input = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...(saveToHistory ? this.conversationHistory : [{ role: 'user', content: message }])
      ];

      // licenseApi経由でOpenAI APIを呼び出し
      const fullResponse = await licenseApi.chat(input, {
        model: model,
        stream: true,
        onStream: onStream
      });

      // アシスタントの返答を履歴に追加
      if (saveToHistory) {
        this.conversationHistory.push({
          role: 'assistant',
          content: fullResponse
        });

        // ローカルストレージに保存
        this.saveConversationHistory();
      }

      return fullResponse;

    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  // ツール（Function calling）付きでチャット
  async chatWithTools(message, tools, onStream) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      // 会話履歴に追加
      this.conversationHistory.push({
        role: 'user',
        content: message
      });

      // 履歴が長すぎる場合は古いものを削除
      if (this.conversationHistory.length > this.maxHistoryLength) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
      }

      // input配列を構築
      const input = [
        {
          role: 'system',
          content: this.systemPrompt
        },
        ...this.conversationHistory
      ];

      const instructions = `【重要：ツール使用の絶対ルール】

あなたは提供されたツールを必ず積極的に使用してください。以下の場合は絶対にツールを使用すること：

1. 最新情報・リアルタイム情報（必須）:
   【Web検索が必須のキーワード】
   以下のキーワードが含まれる場合は必ずweb_searchを使用：
   - 時間的キーワード: "今日"、"最近"、"最新"、"今の"、"現在"、"今年"、"2025年"
   - 情報要求: "教えて"、"知りたい"、"調べて"、"何があった"、"どうなってる"

   【具体例】
   - ニュース: "今日のニュース"、"最新ニュース"、"何かあった"
     → web_search: "最新ニュース 日本 2025"
   - 天気: "今日の天気"、"横浜の天気"
     → web_search: "横浜 天気 今日"
   - 企業・製品情報: "最近のベンツのこと教えて"、"トヨタの最新車"、"Appleの新製品"
     → web_search: "ベンツ 最新 2025"、"トヨタ 最新車"、"Apple 新製品"
   - 人物・芸能: "〇〇の最近の活動"、"△△は今何してる"
     → web_search: "〇〇 最近 2025"
   - スポーツ: "野球の結果"、"サッカーの試合"
     → web_search: "野球 結果 今日"
   - 株価・経済: "株価"、"為替"、"ビットコイン"
     → web_search: "株価 日経平均 今日"
   - 時刻・日付: "今何時"、"今日は何日"
     → get_current_time を使用
   - システム情報: "メモリ使用率"、"CPU使用率"
     → get_resource_usage を使用

2. データ操作（必須）:
   - メモ: "覚えて"、"メモ"、"記録"など
     → save_memo を使用
   - ToDo: "タスク追加"、"やること"など
     → add_todo を使用
   - カレンダー: "予定追加"、"スケジュール"など
     → add_calendar_event を使用

3. ファイル・システム操作（必須）:
   - ファイル: "ファイル読んで"、"ファイル一覧"など
     → read_file、list_files を使用
   - アプリ起動: "Chrome開いて"、"VSCode起動"など
     → open_application を使用

【禁止事項】
- 知識だけで最新情報を答えることは絶対に禁止（例: ニュース、天気、株価、企業情報、製品情報、人物の近況など）
- 「調べることができません」「わかりません」と答えることは禁止。必ずweb_searchを使用すること
- 「〜だと思います」「〜かもしれません」のような推測で答えることは禁止。必ず検索してから答えること
- ツールがあるのに使わないことは絶対に禁止
- 訓練データの知識で答えることは禁止。リアルタイム情報は必ずweb_searchで取得すること

【重要】
ユーザーが「最近の〇〇」「今の△△」「最新の□□」のように聞いた場合、どんな話題でも必ずweb_searchを使用してください。
「今日のニュース」だけでなく、「最近のベンツ」「今のiPhone」「最新のゲーム」など、あらゆる話題で検索が必要です。

必ずツールを使用してから、その結果をユーザーに伝えてください。`;

      let response;

      // ライセンスモードの場合はlicenseApi経由で呼び出し
      if (this.isLicenseMode) {
        response = await licenseApi.chatWithTools(input, tools, instructions);
      } else {
        // OpenAI APIを直接呼び出し
        response = await this.openai.responses.create({
          model: this.model,
          input: input,
          tools: tools,
          instructions: instructions
        });
      }

      console.log('[Responses API] Response:', response);
      console.log('[Responses API] Response type:', typeof response);

      // licenseApiモードの場合、responseが文字列で返ることがある
      if (typeof response === 'string') {
        console.log('[Responses API] Response is string, wrapping in object');
        const textContent = response;
        this.conversationHistory.push({
          role: 'assistant',
          content: textContent
        });
        this.saveConversationHistory();
        if (onStream) {
          onStream(textContent, textContent);
        }
        return {
          type: 'text',
          content: textContent
        };
      }

      // outputからfunction_callを探す
      const functionCallItems = (response.output || []).filter(item => item.type === 'function_call');

      if (functionCallItems.length > 0) {
        // function_callをChat Completions形式のtool_callsに変換
        const toolCalls = functionCallItems.map(item => ({
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments: JSON.stringify(item.arguments)
          }
        }));

        // 会話履歴にレスポンスのoutput配列を展開して追加（Responses APIの推奨方法）
        if (response.output) {
          this.conversationHistory.push(...response.output);
        }

        return {
          type: 'tool_calls',
          tool_calls: toolCalls,
          response: response
        };
      }

      // 通常のテキスト応答 - outputから直接テキストを抽出
      let fullResponse = '';
      if (response.output && Array.isArray(response.output)) {
        // outputからmessageタイプを探してテキストを結合
        const messageItems = response.output.filter(item => item.type === 'message');
        fullResponse = messageItems.map(item => {
          if (typeof item.content === 'string') {
            return item.content;
          } else if (Array.isArray(item.content)) {
            return item.content.map(c => c.text || '').join('');
          }
          return '';
        }).join('');
      }

      // フォールバック: output_textヘルパーを使用
      if (!fullResponse && response.output_text) {
        fullResponse = response.output_text;
      }

      console.log('[Chat] Extracted response text:', fullResponse);
      console.log('[Chat] Response output structure:', JSON.stringify(response.output, null, 2));

      // アシスタントの返答を履歴に追加
      if (fullResponse) {
        this.conversationHistory.push({
          role: 'assistant',
          content: fullResponse
        });
      } else {
        console.warn('[Chat] fullResponse is empty! response:', response);
      }

      // ローカルストレージに保存
      this.saveConversationHistory();

      if (onStream) {
        onStream(fullResponse, fullResponse);
      }

      return {
        type: 'text',
        content: fullResponse
      };

    } catch (error) {
      console.error('Chat with tools error:', error);
      throw error;
    }
  }

  // ツール実行結果を追加して再度チャット
  async continueWithToolResult(toolCallId, toolName, toolResult, onStream) {
    try {
      // ツールの実行結果をfunction_call_output形式で追加
      const functionCallOutput = {
        type: 'function_call_output',
        call_id: toolCallId,
        output: JSON.stringify(toolResult)
      };

      // 会話履歴に追加
      this.conversationHistory.push(functionCallOutput);

      // input配列を構築
      const input = [
        {
          role: 'system',
          content: this.systemPrompt
        },
        ...this.conversationHistory
      ];

      let response;

      // ライセンスモードの場合はlicenseApi経由で呼び出し
      if (this.isLicenseMode) {
        response = await licenseApi.continueWithToolResult(input);
      } else {
        // OpenAI APIを直接呼び出し
        response = await this.openai.responses.create({
          model: this.model,
          input: input,
        });
      }

      const fullResponse = response.output_text || '';

      // アシスタントの返答を履歴に追加
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse
      });

      // ローカルストレージに保存
      this.saveConversationHistory();

      if (onStream) {
        onStream(fullResponse, fullResponse);
      }

      return fullResponse;

    } catch (error) {
      console.error('Continue with tool result error:', error);
      throw error;
    }
  }

  // 会話履歴をローカルストレージに保存
  saveConversationHistory() {
    try {
      // function_call_output等の複雑なオブジェクトも保存
      localStorage.setItem('conversationHistory', JSON.stringify(this.conversationHistory));
    } catch (error) {
      console.error('Failed to save conversation history:', error);
    }
  }

  // 会話履歴をローカルストレージから読み込み
  loadConversationHistory() {
    try {
      const saved = localStorage.getItem('conversationHistory');
      if (saved) {
        const history = JSON.parse(saved);
        // 古い形式をフィルタリング（Responses API移行対応）
        this.conversationHistory = history.filter(item => {
          // Items形式（type属性を持つ）はそのまま通す
          if (item.type) return true;
          // Messages形式: role='user'/'assistant'/'system'のみ許可（tool, developer等は除外）
          if (item.role && ['user', 'assistant', 'system'].includes(item.role) && item.content !== null) {
            return true;
          }
          // それ以外は除外
          return false;
        });
        console.log('Loaded conversation history:', this.conversationHistory.length, 'items');
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      this.conversationHistory = [];
    }
  }

  // 会話履歴をクリア
  clearHistory() {
    this.conversationHistory = [];
    localStorage.removeItem('conversationHistory');
  }

  getConversationHistory() {
    return [...this.conversationHistory];
  }

  // システムプロンプトを更新
  updateSystemPrompt(newPrompt) {
    this.systemPrompt = newPrompt;
    console.log('System prompt updated:', this.systemPrompt);
  }

  // 画像付きチャット
  async chatWithImage(message, imageBase64, onStream) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      console.log('[AIService] chatWithImage called');
      console.log('[AIService] Message:', message);
      console.log('[AIService] Image base64 length:', imageBase64.length);

      // 会話履歴にテキストメッセージを追加
      this.conversationHistory.push({
        role: 'user',
        content: message
      });

      // input配列を構築（画像付き）
      const input = [
        {
          role: 'system',
          content: this.systemPrompt
        },
        ...this.conversationHistory.slice(0, -1), // 最後のテキストメッセージ以外
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message
            },
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${imageBase64}`
            }
          ]
        }
      ];

      console.log('[AIService] Input prepared, calling API...');
      console.log('[AIService] Model:', this.model);

      // licenseApi経由でOpenAI APIを呼び出し
      const fullResponse = await licenseApi.chat(input, {
        model: this.model,
        stream: true,
        onStream: onStream
      });

      console.log('[AIService] Response completed. Full response length:', fullResponse.length);

      // アシスタントの返答を履歴に追加
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse
      });

      // ローカルストレージに保存
      this.saveConversationHistory();

      return fullResponse;

    } catch (error) {
      console.error('Chat with image error:', error);
      throw error;
    }
  }

  // 画像付きチャット（TTS対応版）
  async chatWithImageAndTTS(message, imageBase64, onStream) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      console.log('[AIService] chatWithImageAndTTS called');

      // TTS用のシステムプロンプト
      const ttsSystemPrompt = `${this.systemPrompt}

【重要】必ず以下のJSON形式で返してください：
\`\`\`json
{
  "display": "通常の文章",
  "tts": "英語だけカタカナに変換した文章"
}
\`\`\`

【TTS変換ルール】
- 英語だけカタカナに変換
- 漢字・ひらがなはそのまま
- 例: "Amazonを見る" → "アマゾンを見る"

簡潔に（1〜3文程度）`;

      // 会話履歴にテキストメッセージを追加
      this.conversationHistory.push({
        role: 'user',
        content: message
      });

      // input配列を構築（画像付き）
      const input = [
        {
          role: 'system',
          content: ttsSystemPrompt
        },
        ...this.conversationHistory.slice(0, -1),
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message
            },
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${imageBase64}`
            }
          ]
        }
      ];

      // licenseApi経由でOpenAI APIを呼び出し
      const fullResponse = await licenseApi.chat(input, {
        model: this.model,
        stream: true,
        onStream: (delta, fullText) => {
          if (onStream) {
            // JSONパース試行
            try {
              const partial = JSON.parse(fullText);
              if (partial.display) {
                onStream(delta, partial.display);
              }
            } catch (e) {
              // JSONが完成していない場合は何もしない
            }
          }
        }
      });

      // JSONパース
      let parsedResponse = null;
      try {
        let jsonText = fullResponse.trim();
        if (jsonText.includes('```json')) {
          jsonText = jsonText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        } else if (jsonText.includes('```')) {
          jsonText = jsonText.match(/```\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        }

        parsedResponse = JSON.parse(jsonText);

        if (!parsedResponse.display || !parsedResponse.tts) {
          throw new Error('Invalid format');
        }
      } catch (e) {
        console.error('[AIService] Failed to parse image TTS response:', e);
        parsedResponse = {
          display: fullResponse,
          tts: fullResponse
        };
      }

      // ストリーミング中に表示できなかった場合、最終結果を表示
      if (onStream && parsedResponse.display) {
        onStream('', parsedResponse.display);
      }

      // アシスタントの返答を履歴に追加（最後のユーザーメッセージを削除してから）
      this.conversationHistory.pop();
      this.conversationHistory.push(
        {
          role: 'user',
          content: message
        },
        {
          role: 'assistant',
          content: parsedResponse.display
        }
      );

      // ローカルストレージに保存
      this.saveConversationHistory();

      return parsedResponse;

    } catch (error) {
      console.error('Chat with image and TTS error:', error);
      throw error;
    }
  }

  // TTS対応チャット（表示用とTTS用の2つを生成）
  async chatWithTTS(message, onStream, options = {}) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      const {
        model = this.model,
        temperature = undefined,
        saveToHistory = true
      } = options;

      // TTS用のシステムプロンプトを追加
      const ttsSystemPrompt = `${this.systemPrompt}

【重要】必ず以下のJSON形式で返してください：
\`\`\`json
{
  "display": "通常の文章",
  "tts": "英語だけカタカナに変換した文章"
}
\`\`\`

【TTS変換ルール】
- 英語だけカタカナに変換
- 漢字・ひらがなはそのまま
- 例: "OpenAI GPT-4.1を使う" → "オープンエーアイ ジーピーティー4てん1を使う"`;

      // 会話履歴に追加
      if (saveToHistory) {
        this.conversationHistory.push({
          role: 'user',
          content: message
        });

        // 履歴が長すぎる場合は古いものを削除
        if (this.conversationHistory.length > this.maxHistoryLength) {
          this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
      }

      // input配列を構築
      const input = [
        {
          role: 'system',
          content: ttsSystemPrompt
        },
        ...(saveToHistory ? this.conversationHistory : [{ role: 'user', content: message }])
      ];

      // Responses APIを呼び出し（ストリーミング）
      const apiParams = {
        model: model,
        input: input,
        stream: true,
      };

      if (temperature !== undefined) {
        apiParams.temperature = temperature;
      }

      const stream = await this.openai.responses.create(apiParams);

      let fullResponse = '';
      let parsedResponse = null;

      // ストリーミングレスポンスを処理
      for await (const chunk of stream) {
        if (chunk.output && chunk.output.length > 0) {
          for (const item of chunk.output) {
            if (item.type === 'message' && item.content) {
              for (const contentItem of item.content) {
                if (contentItem.type === 'output_text' && contentItem.text) {
                  fullResponse += contentItem.text;

                  // ストリーミング中は表示用テキストのみを逐次表示
                  if (onStream) {
                    // JSONパース試行（途中でもパースできる部分を表示）
                    try {
                      const partial = JSON.parse(fullResponse);
                      if (partial.display) {
                        onStream(contentItem.text, partial.display);
                      }
                    } catch (e) {
                      // JSONが完成していない場合は何もしない
                    }
                  }
                }
              }
            }
          }
        }
      }

      // JSONパース
      try {
        // JSONブロックを抽出（```json ... ``` の場合に対応）
        let jsonText = fullResponse.trim();
        if (jsonText.includes('```json')) {
          jsonText = jsonText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        } else if (jsonText.includes('```')) {
          jsonText = jsonText.match(/```\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        }

        parsedResponse = JSON.parse(jsonText);

        if (!parsedResponse.display || !parsedResponse.tts) {
          throw new Error('Invalid response format: missing display or tts field');
        }
      } catch (parseError) {
        console.error('[AIService] Failed to parse TTS response:', parseError);
        console.error('[AIService] Raw response:', fullResponse);

        // フォールバック: 通常のテキストとして扱う
        parsedResponse = {
          display: fullResponse,
          tts: fullResponse
        };
      }

      // アシスタントの返答を履歴に追加（表示用テキストのみ）
      if (saveToHistory) {
        // 最後のユーザーメッセージを削除（既に追加済み）
        this.conversationHistory.pop();

        // 表示用テキストを履歴に追加
        this.conversationHistory.push(
          {
            role: 'user',
            content: message
          },
          {
            role: 'assistant',
            content: parsedResponse.display
          }
        );

        // ローカルストレージに保存
        this.saveConversationHistory();
      }

      return parsedResponse;

    } catch (error) {
      console.error('Chat with TTS error:', error);
      throw error;
    }
  }

  // TTS対応チャット（ツール付き）
  async chatWithToolsAndTTS(message, tools, onStream) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      // 会話履歴に追加
      this.conversationHistory.push({
        role: 'user',
        content: message
      });

      // 履歴が長すぎる場合は古いものを削除
      if (this.conversationHistory.length > this.maxHistoryLength) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
      }

      // TTS用のシステムプロンプト
      const ttsInstructions = `利用可能なツールを積極的に使用してください。最新情報（ニュース、天気、株価など）を求められた場合は、必ずweb_search機能を使って検索してください。

【重要な制約】
- 音声読み上げ用なので、応答は簡潔に（1〜3文、50文字程度まで）
- Web検索結果は要点のみ抽出（詳細な時刻、URL、ソース名は省略）
- 天気の例: 「今日は曇りで暖かいよ」
- ニュースの例: 「〇〇が△△したんだって」
- リスト・箇条書き・引用符は使わない
- キャラクター設定の口調・性格を反映
- 自然な会話調で

【重要】必ず以下のJSON形式で返してください：
\`\`\`json
{
  "display": "通常の文章",
  "tts": "英語だけカタカナに変換した文章"
}
\`\`\`

【TTS変換ルール】
- 英語だけカタカナに変換
- 漢字・ひらがなはそのまま
- 例: "API経由で取得" → "エーピーアイ経由で取得"

URL・ソース名は削除`;

      // input配列を構築
      const input = [
        {
          role: 'system',
          content: this.systemPrompt
        },
        ...this.conversationHistory
      ];

      // Responses APIを呼び出し（ツール付き、非ストリーミング）
      const response = await this.openai.responses.create({
        model: this.model,
        input: input,
        tools: tools,
        instructions: ttsInstructions
      });

      console.log('[Responses API] Response:', response);

      // outputからfunction_callを探す
      const functionCallItems = (response.output || []).filter(item => item.type === 'function_call');

      if (functionCallItems.length > 0) {
        // function_callをChat Completions形式のtool_callsに変換
        const toolCalls = functionCallItems.map(item => ({
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments: JSON.stringify(item.arguments)
          }
        }));

        // 会話履歴にレスポンスのoutput配列を展開して追加
        this.conversationHistory.push(...response.output);

        return {
          type: 'tool_calls',
          tool_calls: toolCalls,
          response: response
        };
      }

      // 通常のテキスト応答 - outputから直接テキストを抽出
      let fullResponse = '';
      if (response.output && Array.isArray(response.output)) {
        // outputからmessageタイプを探してテキストを結合
        const messageItems = response.output.filter(item => item.type === 'message');
        fullResponse = messageItems.map(item => {
          if (typeof item.content === 'string') {
            return item.content;
          } else if (Array.isArray(item.content)) {
            return item.content.map(c => c.text || '').join('');
          }
          return '';
        }).join('');
      }

      // フォールバック: output_textヘルパーを使用
      if (!fullResponse && response.output_text) {
        fullResponse = response.output_text;
      }

      console.log('[Speech] Extracted response text:', fullResponse);

      // JSONパース試行
      let parsedResponse = null;
      try {
        let jsonText = fullResponse.trim();
        if (jsonText.includes('```json')) {
          jsonText = jsonText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        } else if (jsonText.includes('```')) {
          jsonText = jsonText.match(/```\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        }

        parsedResponse = JSON.parse(jsonText);

        if (!parsedResponse.display || !parsedResponse.tts) {
          throw new Error('Invalid format');
        }
      } catch (e) {
        // フォールバック
        parsedResponse = {
          display: fullResponse,
          tts: fullResponse
        };
      }

      // アシスタントの返答を履歴に追加（表示用のみ）
      this.conversationHistory.push({
        role: 'assistant',
        content: parsedResponse.display
      });

      // ローカルストレージに保存
      this.saveConversationHistory();

      if (onStream) {
        onStream(parsedResponse.display, parsedResponse.display);
      }

      return {
        type: 'text',
        content: parsedResponse
      };

    } catch (error) {
      console.error('Chat with tools and TTS error:', error);
      throw error;
    }
  }

  // ツール実行結果を追加して再度チャット（TTS対応版）
  async continueWithToolResultAndTTS(toolCallId, toolName, toolResult, onStream) {
    try {
      // ツールの実行結果をfunction_call_output形式で追加
      const functionCallOutput = {
        type: 'function_call_output',
        call_id: toolCallId,
        output: JSON.stringify(toolResult)
      };

      // 会話履歴に追加
      this.conversationHistory.push(functionCallOutput);

      // TTS用のシステムプロンプト
      const ttsSystemPrompt = `${this.systemPrompt}

【重要】必ず以下のJSON形式で返してください：
\`\`\`json
{
  "display": "通常の文章",
  "tts": "英語だけカタカナに変換した文章"
}
\`\`\`

【TTS変換ルール】
- 英語だけカタカナに変換
- 漢字・ひらがなはそのまま
- 例: "タイマーを設定" → "タイマーを設定"（英語ないので変換なし）`;

      // input配列を構築
      const input = [
        {
          role: 'system',
          content: ttsSystemPrompt
        },
        ...this.conversationHistory
      ];

      // 再度APIを呼び出し
      const response = await this.openai.responses.create({
        model: this.model,
        input: input,
      });

      const fullResponse = response.output_text || '';

      // JSONパース
      let parsedResponse = null;
      try {
        let jsonText = fullResponse.trim();
        if (jsonText.includes('```json')) {
          jsonText = jsonText.match(/```json\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        } else if (jsonText.includes('```')) {
          jsonText = jsonText.match(/```\s*([\s\S]*?)\s*```/)?.[1] || jsonText;
        }

        parsedResponse = JSON.parse(jsonText);

        if (!parsedResponse.display || !parsedResponse.tts) {
          throw new Error('Invalid format');
        }
      } catch (e) {
        parsedResponse = {
          display: fullResponse,
          tts: fullResponse
        };
      }

      // アシスタントの返答を履歴に追加（表示用のみ）
      this.conversationHistory.push({
        role: 'assistant',
        content: parsedResponse.display
      });

      // ローカルストレージに保存
      this.saveConversationHistory();

      if (onStream) {
        onStream(parsedResponse.display, parsedResponse.display);
      }

      return parsedResponse;

    } catch (error) {
      console.error('Continue with tool result and TTS error:', error);
      throw error;
    }
  }

  // 挨拶検出
  detectGreeting(text) {
    const lowerText = text.toLowerCase();
    const greetings = [
      'こんにちは', 'こんばんは', 'おはよう', 'やあ', 'ハロー',
      'hello', 'hi', 'hey', 'よろしく', 'はじめまして'
    ];

    return greetings.some(greeting => lowerText.includes(greeting));
  }

  // 感情分析（改良版）
  analyzeEmotion(text) {
    const lowerText = text.toLowerCase();

    const emotions = {
      happy: [
        '嬉しい', '楽しい', 'happy', 'joy', '喜', '笑',
        'わーい', 'やった', 'よかった', '素敵', '素晴らしい',
        'ありがとう', '感謝', 'にこにこ', '✨', '💖'
      ],
      sad: [
        '悲しい', '寂しい', 'sad', 'sorry', '残念',
        'つらい', '泣', 'ごめん', '申し訳', '涙'
      ],
      angry: [
        '怒', 'angry', 'mad', 'イライラ', 'むかつ',
        'ふざけ', 'やめ', 'だめ', '許さ'
      ],
      surprised: [
        '驚', '!?', 'wow', 'amazing', 'びっくり',
        'すごい', 'まさか', 'えっ', 'おお', '本当'
      ],
      thinking: [
        '考え', '思', 'うーん', 'えーと', 'そうですね',
        'かも', 'でしょう', 'だと思', 'かな'
      ]
    };

    // 感情スコアを計算
    const scores = {};
    for (const [emotion, keywords] of Object.entries(emotions)) {
      scores[emotion] = keywords.filter(keyword =>
        lowerText.includes(keyword)
      ).length;
    }

    // 最も高いスコアの感情を返す
    let maxScore = 0;
    let detectedEmotion = 'neutral';

    for (const [emotion, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    }

    // 複数の感情記号がある場合の調整
    if (text.includes('！') && text.includes('？')) {
      return 'surprised';
    } else if (text.includes('！') && maxScore === 0) {
      return 'happy';
    }

    return detectedEmotion;
  }

  // GPT-5 nano用の簡易API呼び出し（履歴なし、ストリーミングなし）
  async simpleQuery(prompt, systemPrompt = null, options = {}) {
    if (!this.isReady) {
      throw new Error('AI Service not initialized');
    }

    try {
      const {
        model = 'gpt-5-nano',
        maxTokens = 100,
        reasoningEffort = 'minimal', // gpt-5-nanoは minimal が推奨
        verbosity = 'low' // 簡潔な出力
      } = options;

      const input = [
        {
          role: 'system',
          content: systemPrompt || 'あなたは簡潔に答えるアシスタントです。'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      // ライセンスモードの場合はlicenseApi経由、そうでなければOpenAI直接
      if (this.isLicenseMode) {
        const result = await licenseApi.chat(input, {
          model: model,
          stream: false
        });
        console.log(`[AIService] simpleQuery (${model}) via license:`, { prompt, result });
        return result;
      } else {
        const apiParams = {
          model: model,
          input: input,
          stream: false,
          max_output_tokens: maxTokens,
          reasoning: { effort: reasoningEffort },
          text: { verbosity: verbosity }
        };

        const response = await this.openai.responses.create(apiParams);

        const result = response.output_text || '';
        console.log(`[AIService] simpleQuery (${model}):`, { prompt, result });

        return result;
      }

    } catch (error) {
      console.error('Simple query error:', error);
      throw error;
    }
  }

  // GPT-4.1-miniでMMD表情モーフを選択（配列形式）
  // MMD用: 表情モーフを1〜3個選択
  async generateExpressionParams(context, availableExpressions) {
    // 母音モーフのみを除外（口パク用）、それ以外は全て選択肢に
    const expressionMorphs = availableExpressions.filter(morphName => {
      const lower = morphName.toLowerCase();

      // 母音モーフは除外（口パクで使用）
      if (morphName === 'あ' || morphName === 'い' || morphName === 'う' ||
          morphName === 'え' || morphName === 'お' ||
          morphName === 'ワ' || morphName === 'ω' ||
          lower === 'a' || lower === 'i' || lower === 'u' ||
          lower === 'e' || lower === 'o') {
        return false;
      }

      // 瞳のサイズ変更モーフは除外
      if (morphName.includes('瞳小') || morphName.includes('瞳大') ||
          morphName.includes('瞳増大') || morphName.includes('瞳縦') ||
          morphName.includes('瞳横') || morphName.includes('瞳潰')) {
        return false;
      }

      // 口角関連は除外（選択しない）
      if (morphName.includes('口角広げ') || morphName.includes('口角上げ')) {
        return false;
      }

      return true;
    });

    if (expressionMorphs.length === 0) {
      console.warn('[GPT-4.1-mini] No expression morphs available');
      return null;
    }

    const morphList = expressionMorphs.join(', ');

    const systemPrompt = `あなたは一流の表情クリエイターです。
発話内容に合った表情モーフを1〜3個選択してください。
創造性を発揮して、キャラクターの個性を引き出してください。

【基本的な使い分け】
- 嬉しい：笑い、にっこり等
- 悲しい：はぅ、困る等
- 怒り：じと目、怒り等の組み合わせ
- 驚き：びっくり等
- しいたけ：目の中に十字のハイライトが入る可愛い表情、キラキラとした目のこと

【重要なルール】
- 「はぅ」「なごみ」「ウィンク」は必ず単独使用（配列に1つだけ）
- 「はぅ（＞＜）」「なごみ（＝w＝）」は単独使用だが、とても可愛らしい表情なので文脈に合えばよく使ってください
- 目を大きく変える強いモーフ同士は組み合わせない
- JSON配列形式のみ返す`;

    // 表情履歴をプロンプトに含める
    let historyText = '';
    if (this.expressionHistory.length > 0) {
      const recentHistory = this.expressionHistory.slice(-3).map(h => h.join(', ')).join(' → ');
      historyText = `\n\n前回までの表情: ${recentHistory}\n同じ表情ばかり使わず、バリエーションを持たせてください。`;
    }

    try {
      const result = await this.simpleQuery(
        `発話内容: "${context}"

利用可能なモーフ: ${morphList}${historyText}

この発話に合った表情モーフを1〜3個選んでJSON配列で返してください。

JSON:`,
        systemPrompt,
        { model: 'gpt-4.1-mini', maxTokens: 500 }
      );

      console.log('[GPT-5 nano] Raw response:', result);

      if (!result || result.trim().length === 0) {
        console.warn('[GPT-5 nano] Empty response');
        return null;
      }

      let jsonText = result.trim();

      // Extract JSON配列（[...]）
      const jsonMatch = jsonText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      } else {
        console.warn('[GPT-5 nano] No JSON array in response');
        return null;
      }

      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        console.warn('[GPT-5 nano] Response is not an array');
        return null;
      }

      console.log('[GPT-5 nano] Selected morphs:', parsed);

      // 表情履歴に追加
      this.expressionHistory.push(parsed);
      if (this.expressionHistory.length > this.maxExpressionHistory) {
        this.expressionHistory.shift(); // 古いものを削除
      }

      return parsed;

    } catch (error) {
      console.error('[GPT-5 nano] Error:', error);
      return null;
    }
  }

  destroy() {
    this.saveConversationHistory();
    this.openai = null;
    this.isReady = false;
  }
}

// シングルトンインスタンス
const aiService = new AIService();
export default aiService;
