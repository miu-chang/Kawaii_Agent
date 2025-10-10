import licenseApi from './licenseApi';

class OpenAIService {
  constructor() {
    this.apiKey = null;
    this.isReady = false;
  }

  async initialize(apiKey) {
    if (this.isReady) return;

    try {
      this.apiKey = apiKey;
      this.isReady = true;
      console.log('OpenAI Service ready!');
    } catch (error) {
      console.error('Failed to initialize OpenAI:', error);
      throw error;
    }
  }

  async chat(prompt, options = {}) {
    if (!this.isReady) {
      throw new Error('OpenAI Service not initialized');
    }

    try {
      const {
        systemPrompt = '',
        temperature = 0.9,
        maxTokens = 150,
        conversationHistory = [] // 会話履歴を受け取る
      } = options;

      const messages = [];

      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // 会話履歴を追加
      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory);
      }

      messages.push({
        role: 'user',
        content: prompt
      });

      // licenseApi経由でバックエンドを呼び出し
      const response = await licenseApi.chat(messages, {
        model: 'gpt-4.1-mini',
        stream: false
      });

      return response;
    } catch (error) {
      console.error('OpenAI chat error:', error);
      throw error;
    }
  }

  destroy() {
    this.apiKey = null;
    this.isReady = false;
  }
}

// シングルトンインスタンス
const openaiService = new OpenAIService();
export default openaiService;
