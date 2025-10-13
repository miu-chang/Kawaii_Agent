/**
 * VRoid Hub API連携サービス（バックエンド経由）
 */

import licenseApi from './licenseApi';

const API_BASE_URL = process.env.BACKEND_API_URL || 'https://kawaii-agent-backend.vercel.app';

class VRoidApiService {
  constructor() {
    this.isConnected = false;
    this.loadConnectionStatus();
  }

  /**
   * 接続状態をローカルストレージから読み込み
   */
  loadConnectionStatus() {
    try {
      const stored = localStorage.getItem('vroid_connected');
      this.isConnected = stored === 'true';
    } catch (error) {
      console.error('[VRoid API] Failed to load connection status:', error);
    }
  }

  /**
   * 接続状態を保存
   */
  saveConnectionStatus(connected) {
    try {
      this.isConnected = connected;
      localStorage.setItem('vroid_connected', connected.toString());
    } catch (error) {
      console.error('[VRoid API] Failed to save connection status:', error);
    }
  }

  /**
   * 認証済みかチェック
   */
  isAuthenticated() {
    return this.isConnected;
  }

  /**
   * OAuth認証URLを取得して開く
   */
  async openAuthWindow() {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/vroid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, action: 'auth_url' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get auth URL');
      }

      const data = await response.json();

      // 外部ブラウザで認証URLを開く
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(data.authUrl);
      } else {
        window.open(data.authUrl, '_blank');
      }

      console.log('[VRoid API] Auth window opened');
    } catch (error) {
      console.error('[VRoid API] Failed to open auth window:', error);
      throw error;
    }
  }

  /**
   * 認可コードをトークンに交換
   */
  async exchangeCodeForToken(code) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/vroid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, action: 'callback', code })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Token exchange failed');
      }

      const data = await response.json();
      this.saveConnectionStatus(true);

      console.log('[VRoid API] Successfully authenticated');
      return data;
    } catch (error) {
      console.error('[VRoid API] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * ログアウト
   */
  logout() {
    this.saveConnectionStatus(false);
    console.log('[VRoid API] Logged out');
  }

  /**
   * キャラクター一覧を取得
   */
  async getCharacters(options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/vroid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'characters',
          ...options
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch characters');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[VRoid API] Get characters error:', error);
      throw error;
    }
  }

  /**
   * VRMファイルのObject URLを取得
   */
  async getVrmObjectUrl(characterModelId) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      // 1. ダウンロードライセンスを作成
      console.log('[VRoid API] Creating download license for character model:', characterModelId);
      const licenseResponse = await fetch(`${API_BASE_URL}/api/vroid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'download_license',
          characterModelId
        })
      });

      if (!licenseResponse.ok) {
        const error = await licenseResponse.json();
        throw new Error(error.error || 'Failed to create download license');
      }

      const licenseData = await licenseResponse.json();
      const downloadLicenseId = licenseData.license.id;

      // 2. ダウンロードURLを取得
      console.log('[VRoid API] Getting download URL...');
      const urlResponse = await fetch(`${API_BASE_URL}/api/vroid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'download_url',
          downloadLicenseId
        })
      });

      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.error || 'Failed to get download URL');
      }

      const urlData = await urlResponse.json();
      const vrmUrl = urlData.url;

      // 3. VRMファイルをダウンロード
      console.log('[VRoid API] Downloading VRM file...');
      const vrmResponse = await fetch(vrmUrl);

      if (!vrmResponse.ok) {
        throw new Error('Failed to download VRM file');
      }

      const blob = await vrmResponse.blob();

      // 4. Object URLを作成
      const objectUrl = URL.createObjectURL(blob);
      console.log('[VRoid API] VRM object URL created');
      return objectUrl;

    } catch (error) {
      console.error('[VRoid API] Get VRM object URL error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
const vroidApiService = new VRoidApiService();
export default vroidApiService;
