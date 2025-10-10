/**
 * バックエンドAPI連携サービス
 */

const API_BASE_URL = process.env.BACKEND_API_URL || 'https://your-app.vercel.app';

class LicenseAPI {
  constructor() {
    this.licenseKey = null;
    this.licenseInfo = null;
    this.loadLicenseFromStorage();
  }

  /**
   * ローカルストレージからライセンスキーを読み込み
   */
  loadLicenseFromStorage() {
    try {
      const stored = localStorage.getItem('kawaii_agent_license');
      if (stored) {
        const data = JSON.parse(stored);
        this.licenseKey = data.licenseKey;
        this.licenseInfo = data.licenseInfo;
      }
    } catch (error) {
      console.error('Failed to load license from storage:', error);
    }
  }

  /**
   * ローカルストレージにライセンスを保存
   */
  saveLicenseToStorage() {
    try {
      const data = {
        licenseKey: this.licenseKey,
        licenseInfo: this.licenseInfo
      };
      localStorage.setItem('kawaii_agent_license', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save license to storage:', error);
    }
  }

  /**
   * ライセンスキーを検証
   */
  async verifyLicense(licenseKey) {
    // 引数が渡されなかった場合は保存されているライセンスキーを使用
    const keyToVerify = licenseKey || this.licenseKey;

    if (!keyToVerify) {
      return { success: false, error: 'No license key provided' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-license`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ licenseKey: keyToVerify })
      });

      const data = await response.json();

      if (data.valid) {
        this.licenseKey = keyToVerify;
        this.licenseInfo = {
          plan: data.plan,
          tokensLimit: data.tokensLimit,
          expiresAt: data.expiresAt
        };
        this.saveLicenseToStorage();
        return { success: true, info: this.licenseInfo };
      } else {
        return { success: false, error: data.error || 'Invalid license' };
      }
    } catch (error) {
      console.error('License verification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * OpenAI APIを呼び出し（バックエンド経由）
   */
  async chat(input, options = {}) {
    if (!this.licenseKey) {
      throw new Error('No license key configured. Please add a license key.');
    }

    const { model = 'gpt-4o-mini', stream = true, onStream } = options;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          licenseKey: this.licenseKey,
          input,
          model,
          stream
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }

      if (stream) {
        // ストリーミングレスポンスを処理
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return fullResponse;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.delta) {
                  fullResponse += parsed.delta;
                  if (onStream) {
                    onStream(parsed.delta, fullResponse);
                  }
                }
              } catch (e) {
                // パースエラーは無視
              }
            }
          }
        }

        return fullResponse;
      } else {
        // 非ストリーミング
        const data = await response.json();
        return data.response;
      }
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }

  /**
   * OpenAI APIを呼び出し（ツール付き、バックエンド経由）
   */
  async chatWithTools(input, tools, instructions) {
    if (!this.licenseKey) {
      throw new Error('No license key configured. Please add a license key.');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          licenseKey: this.licenseKey,
          input,
          tools,
          instructions,
          stream: false  // ツール呼び出しは非ストリーミング
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }

      const data = await response.json();
      return data.response;  // 完全なレスポンスオブジェクト

    } catch (error) {
      console.error('Chat with tools API error:', error);
      throw error;
    }
  }

  /**
   * ツール実行後の続きを取得（バックエンド経由）
   */
  async continueWithToolResult(input) {
    if (!this.licenseKey) {
      throw new Error('No license key configured. Please add a license key.');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          licenseKey: this.licenseKey,
          input,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }

      const data = await response.json();
      return data.response;

    } catch (error) {
      console.error('Continue with tool result API error:', error);
      throw error;
    }
  }

  /**
   * 使用量を取得
   */
  async getUsage() {
    if (!this.licenseKey) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ licenseKey: this.licenseKey })
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        console.error('Failed to get usage:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Get usage error:', error);
      return null;
    }
  }

  /**
   * ライセンスをクリア
   */
  clearLicense() {
    this.licenseKey = null;
    this.licenseInfo = null;
    localStorage.removeItem('kawaii_agent_license');
  }

  /**
   * ライセンスが有効かチェック
   */
  hasValidLicense() {
    return !!this.licenseKey;
  }

  /**
   * ライセンス情報を取得
   */
  getLicenseInfo() {
    return this.licenseInfo;
  }
}

// シングルトンインスタンス
const licenseApi = new LicenseAPI();
export default licenseApi;
