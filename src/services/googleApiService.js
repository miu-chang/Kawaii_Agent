/**
 * Google API連携サービス（バックエンド経由）
 */

import licenseApi from './licenseApi';

const API_BASE_URL = process.env.BACKEND_API_URL || 'https://kawaii-agent-backend.vercel.app';

class GoogleApiService {
  constructor() {
    this.isConnected = false;
    this.loadConnectionStatus();
  }

  /**
   * 接続状態をローカルストレージから読み込み
   */
  loadConnectionStatus() {
    try {
      const stored = localStorage.getItem('google_connected');
      this.isConnected = stored === 'true';
    } catch (error) {
      console.error('[Google API] Failed to load connection status:', error);
    }
  }

  /**
   * 接続状態を保存
   */
  saveConnectionStatus(connected) {
    try {
      this.isConnected = connected;
      localStorage.setItem('google_connected', connected.toString());
    } catch (error) {
      console.error('[Google API] Failed to save connection status:', error);
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

      const response = await fetch(`${API_BASE_URL}/api/google`, {
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

      console.log('[Google API] Auth window opened');
    } catch (error) {
      console.error('[Google API] Failed to open auth window:', error);
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

      const response = await fetch(`${API_BASE_URL}/api/google`, {
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

      console.log('[Google API] Successfully authenticated');
      return data;
    } catch (error) {
      console.error('[Google API] Token exchange error:', error);
      throw error;
    }
  }

  /**
   * ログアウト
   */
  logout() {
    this.saveConnectionStatus(false);
    console.log('[Google API] Logged out');
  }

  /**
   * Googleカレンダー: イベント一覧を取得
   */
  async getCalendarEvents(options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const params = {
        licenseKey,
        action: 'calendar_list',
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch calendar events');
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('[Google Calendar] Get events error:', error);
      throw error;
    }
  }

  /**
   * Googleカレンダー: イベントを作成
   */
  async createCalendarEvent(eventData) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'calendar_create',
          ...eventData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      const data = await response.json();
      return data.event;
    } catch (error) {
      console.error('[Google Calendar] Create event error:', error);
      throw error;
    }
  }

  /**
   * Googleカレンダー: イベントを削除
   */
  async deleteCalendarEvent(eventId) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'calendar_delete',
          eventId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      return { success: true };
    } catch (error) {
      console.error('[Google Calendar] Delete event error:', error);
      throw error;
    }
  }

  /**
   * Gmail: メール一覧を取得
   */
  async getGmailMessages(options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const params = {
        licenseKey,
        action: 'gmail_list',
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch messages');
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('[Gmail] Get messages error:', error);
      throw error;
    }
  }

  /**
   * Gmail: メールを送信
   */
  async sendGmailMessage(messageData) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'gmail_send',
          ...messageData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Gmail] Send message error:', error);
      throw error;
    }
  }

  /**
   * Google Drive: ファイル一覧を取得
   */
  async getDriveFiles(options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const params = {
        licenseKey,
        action: 'drive_list',
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list Drive files');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('[Google Drive] List files error:', error);
      throw error;
    }
  }

  /**
   * Google Drive: ファイルを検索
   */
  async searchDriveFiles(query, options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const params = {
        licenseKey,
        action: 'drive_search',
        query,
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search Drive files');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('[Google Drive] Search files error:', error);
      throw error;
    }
  }

  /**
   * Google Drive: 共有リンクを生成
   */
  async shareDriveFile(fileId) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'drive_share',
          fileId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to share file');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Google Drive] Share file error:', error);
      throw error;
    }
  }

  /**
   * Google Tasks: タスク一覧を取得
   */
  async getTasks(options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const params = {
        licenseKey,
        action: 'tasks_list',
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list tasks');
      }

      const data = await response.json();
      return data.tasks || [];
    } catch (error) {
      console.error('[Google Tasks] List tasks error:', error);
      throw error;
    }
  }

  /**
   * Google Tasks: タスクを作成
   */
  async createTask(taskData) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'tasks_create',
          ...taskData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }

      const data = await response.json();
      return data.task;
    } catch (error) {
      console.error('[Google Tasks] Create task error:', error);
      throw error;
    }
  }

  /**
   * Google Tasks: タスクを完了
   */
  async completeTask(taskId) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'tasks_complete',
          taskId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete task');
      }

      const data = await response.json();
      return data.task;
    } catch (error) {
      console.error('[Google Tasks] Complete task error:', error);
      throw error;
    }
  }

  /**
   * Google Tasks: タスクを削除
   */
  async deleteTask(taskId) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'tasks_delete',
          taskId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete task');
      }

      return { success: true };
    } catch (error) {
      console.error('[Google Tasks] Delete task error:', error);
      throw error;
    }
  }

  /**
   * Google Contacts: 連絡先を検索
   */
  async searchContacts(query, options = {}) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const params = {
        licenseKey,
        action: 'contacts_search',
        query,
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to search contacts');
      }

      const data = await response.json();
      return data.contacts || [];
    } catch (error) {
      console.error('[Google Contacts] Search contacts error:', error);
      throw error;
    }
  }

  /**
   * Google Meet: 会議リンクを作成
   */
  async createMeetingLink(meetingData) {
    try {
      const licenseKey = licenseApi.getLicenseKey();
      if (!licenseKey) {
        throw new Error('License key not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          action: 'meet_create',
          ...meetingData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create meeting');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Google Meet] Create meeting error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
const googleApiService = new GoogleApiService();
export default googleApiService;
