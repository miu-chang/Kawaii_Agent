/**
 * VRoid Hub OAuth認証とAPI統合サービス
 */

const VROID_HUB_BASE_URL = 'https://hub.vroid.com';
const VROID_HUB_API_VERSION = '11';

class VRoidHubService {
  constructor() {
    this.clientId = null;
    this.clientSecret = null;
    this.accessToken = null;
    this.refreshToken = null;
    // 開発中はlocalhost（本番ビルド時はカスタムプロトコルに変更）
    this.redirectUri = 'http://localhost:3456/callback';
    this.loadTokenFromStorage();
  }

  /**
   * クライアント情報を設定（.envから読み込み）
   */
  setClientCredentials(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * ローカルストレージからトークンを読み込み
   */
  loadTokenFromStorage() {
    try {
      const stored = localStorage.getItem('vroid_hub_tokens');
      if (stored) {
        const data = JSON.parse(stored);
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
      }
    } catch (error) {
      console.error('[VRoid Hub] Failed to load tokens from storage:', error);
    }
  }

  /**
   * トークンをローカルストレージに保存
   */
  saveTokenToStorage() {
    try {
      const data = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken
      };
      localStorage.setItem('vroid_hub_tokens', JSON.stringify(data));
    } catch (error) {
      console.error('[VRoid Hub] Failed to save tokens to storage:', error);
    }
  }

  /**
   * OAuth認証URLを生成
   */
  getAuthorizationUrl() {
    if (!this.clientId) {
      throw new Error('Client ID not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri
      // scopeパラメータは不要（デフォルトスコープが自動適用される）
    });

    return `${VROID_HUB_BASE_URL}/oauth/authorize?${params.toString()}`;
  }

  /**
   * OAuth認証ウィンドウを開く（Electronのメインプロセスから呼ばれる）
   */
  openAuthWindow() {
    const authUrl = this.getAuthorizationUrl();
    console.log('[VRoid Hub] Opening auth window:', authUrl);

    // Electronのshellで外部ブラウザを開く
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(authUrl);
    } else {
      // フォールバック：新しいウィンドウで開く
      window.open(authUrl, '_blank');
    }
  }

  /**
   * 認可コードからアクセストークンを取得
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Client credentials not configured');
    }

    try {
      const response = await fetch(`${VROID_HUB_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Version': VROID_HUB_API_VERSION
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
          code: code
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Token exchange failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.saveTokenToStorage();

      console.log('[VRoid Hub] Token obtained successfully');
      return data;

    } catch (error) {
      console.error('[VRoid Hub] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * アクセストークンをリフレッシュ
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${VROID_HUB_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Version': VROID_HUB_API_VERSION
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Token refresh failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      this.saveTokenToStorage();

      console.log('[VRoid Hub] Token refreshed successfully');
      return data;

    } catch (error) {
      console.error('[VRoid Hub] Token refresh error:', error);
      throw error;
    }
  }

  /**
   * 認証済みかチェック
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * ログアウト
   */
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('vroid_hub_tokens');
    console.log('[VRoid Hub] Logged out');
  }

  /**
   * キャラクター一覧を取得（お気に入りのモデル）
   */
  async getCharacters(options = {}) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const { count = 100, max_id } = options;

    try {
      const params = new URLSearchParams({
        count: count.toString(),
        // falseにして全てのお気に入りを取得
        // 非公認アプリでは一部のモデルはダウンロードできないが、公認後に使えるようになる
        is_downloadable: 'false'
      });

      if (max_id) {
        params.append('max_id', max_id.toString());
      }

      console.log('[VRoid Hub] Fetching characters with params:', params.toString());

      // お気に入りのモデルを取得
      const response = await fetch(`${VROID_HUB_BASE_URL}/api/hearts?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Api-Version': VROID_HUB_API_VERSION
        }
      });

      if (response.status === 401) {
        // トークン期限切れ、リフレッシュして再試行
        await this.refreshAccessToken();
        return this.getCharacters(options);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VRoid Hub] API Error Response:', errorText);
        throw new Error(`Failed to fetch characters: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[VRoid Hub] Raw API Response:', data);
      console.log('[VRoid Hub] Characters fetched:', data.data?.length || 0);
      console.log('[VRoid Hub] _links:', data._links);
      console.log('[VRoid Hub] Full response keys:', Object.keys(data));

      // データを正規化
      const characters = (data.data || []).map(item => {
        // heartsエンドポイントは直接character_modelの情報を返す
        const characterName = item.character?.name || item.name || 'Unknown';
        const thumbnailUrl = item.portrait_image?.sq300?.url ||
                            item.portrait_image?.w300?.url ||
                            item.full_body_image?.w300?.url ||
                            item.portrait_image?.sq150?.url;

        return {
          id: item.id,
          character_model_id: item.id, // ダウンロードライセンス用のID
          name: characterName,
          thumbnail_url: thumbnailUrl,
          image_url: item.portrait_image?.original?.url || item.full_body_image?.original?.url,
          character: item.character,
          tags: item.tags,
          license: item.license
        };
      });

      return { characters, _links: data._links };

    } catch (error) {
      console.error('[VRoid Hub] Get characters error:', error);
      throw error;
    }
  }

  /**
   * ダウンロードライセンスを取得
   */
  async createDownloadLicense(characterModelId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${VROID_HUB_BASE_URL}/api/download_licenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Api-Version': VROID_HUB_API_VERSION
        },
        body: JSON.stringify({
          character_model_id: characterModelId
        })
      });

      if (response.status === 401) {
        await this.refreshAccessToken();
        return this.createDownloadLicense(characterModelId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VRoid Hub] Create download license error:', errorText);
        throw new Error(`Failed to create download license: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[VRoid Hub] Download license response:', data);
      console.log('[VRoid Hub] Download license ID:', data.data?.id);
      return data.data; // data.dataを返す

    } catch (error) {
      console.error('[VRoid Hub] Create download license error:', error);
      throw error;
    }
  }

  /**
   * ダウンロードライセンスからVRMファイルURLを取得
   * リダイレクトに従って最終的なURLを取得
   */
  async getDownloadUrl(licenseId) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${VROID_HUB_BASE_URL}/api/download_licenses/${licenseId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Api-Version': VROID_HUB_API_VERSION
        }
        // redirect: 'follow'はデフォルトなので省略
      });

      if (response.status === 401) {
        await this.refreshAccessToken();
        return this.getDownloadUrl(licenseId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VRoid Hub] Get download URL error:', errorText);
        throw new Error(`Failed to get download URL: ${response.status} ${errorText}`);
      }

      // リダイレクト後の最終URLを取得
      const finalUrl = response.url;
      console.log('[VRoid Hub] Download URL obtained:', finalUrl);
      return finalUrl;

    } catch (error) {
      console.error('[VRoid Hub] Get download URL error:', error);
      throw error;
    }
  }

  /**
   * VRMファイルをダウンロード（Blob形式）
   */
  async downloadVrmFile(vrmUrl) {
    try {
      const response = await fetch(vrmUrl);

      if (!response.ok) {
        throw new Error('Failed to download VRM file');
      }

      const blob = await response.blob();
      return blob;

    } catch (error) {
      console.error('[VRoid Hub] Download VRM error:', error);
      throw error;
    }
  }

  /**
   * VRMファイルをObject URLに変換
   */
  async getVrmObjectUrl(characterModelId) {
    try {
      // 1. ダウンロードライセンスを作成
      console.log('[VRoid Hub] Creating download license for character model:', characterModelId);
      const license = await this.createDownloadLicense(characterModelId);

      // 2. ダウンロードURLを取得
      console.log('[VRoid Hub] Getting download URL...');
      const vrmUrl = await this.getDownloadUrl(license.id);

      // 3. VRMファイルをダウンロード
      console.log('[VRoid Hub] Downloading VRM file...');
      const blob = await this.downloadVrmFile(vrmUrl);

      // 4. Object URLを作成
      const objectUrl = URL.createObjectURL(blob);
      console.log('[VRoid Hub] VRM object URL created');
      return objectUrl;

    } catch (error) {
      console.error('[VRoid Hub] Get VRM object URL error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
const vroidHubService = new VRoidHubService();
export default vroidHubService;
