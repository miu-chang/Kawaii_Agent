import React, { useState, useEffect } from 'react';
import vroidApiService from '../services/vroidApiService';

/**
 * VRoid Hubからモデルを選択するコンポーネント
 */
export default function VRoidModelPicker({ onSelect, onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // 初期化時に認証状態を確認
  useEffect(() => {
    if (vroidApiService.isAuthenticated()) {
      setIsAuthenticated(true);
      loadCharacters();
    }
  }, []);

  // OAuth コールバック処理
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onVRoidOAuthCode) {
      window.electronAPI.onVRoidOAuthCode(async (code) => {
        console.log('[VRoid Model Picker] OAuth code received');
        try {
          setLoading(true);
          setError(null);
          await vroidApiService.exchangeCodeForToken(code);
          setIsAuthenticated(true);
          await loadCharacters();
        } catch (err) {
          console.error('[VRoid Model Picker] Token exchange failed:', err);
          setError('認証に失敗しました: ' + err.message);
        } finally {
          setLoading(false);
        }
      });

      window.electronAPI.onVRoidOAuthError((error) => {
        console.error('[VRoid Model Picker] OAuth error:', error);
        setError('認証エラー: ' + error);
      });
    }
  }, []);

  // キャラクター一覧を読み込み
  const loadCharacters = async (maxId = null) => {
    try {
      setLoading(true);
      setError(null);

      const options = { count: 100 };
      if (maxId) {
        options.maxId = maxId;
      }

      const data = await vroidApiService.getCharacters(options);

      if (!maxId) {
        // 最初のロード
        setCharacters(data.characters || []);
      } else {
        // 追加ロード
        setCharacters(prev => [...prev, ...(data.characters || [])]);
      }

      // 次のページがあるかチェック（_links.nextがあるか、または件数で判断）
      setHasMore(data._links?.next || (data.characters && data.characters.length === 100));

    } catch (err) {
      console.error('[VRoid Model Picker] Failed to load characters:', err);
      setError('キャラクター一覧の取得に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // VRoid Hub認証を開始
  const handleLogin = async () => {
    try {
      await vroidApiService.openAuthWindow();
    } catch (err) {
      console.error('[VRoid Model Picker] Failed to open auth window:', err);
      setError('認証ウィンドウを開けませんでした: ' + err.message);
    }
  };

  // ログアウト
  const handleLogout = () => {
    vroidApiService.logout();
    setIsAuthenticated(false);
    setCharacters([]);
    setHasMore(true);
  };

  // キャラクターを選択
  const handleSelectCharacter = async (character) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[VRoid Model Picker] Loading character:', character.name, 'ID:', character.character_model_id);

      // VRMファイルのObject URLを取得
      const vrmUrl = await vroidApiService.getVrmObjectUrl(character.character_model_id);

      if (onSelect) {
        onSelect({
          url: vrmUrl,
          name: character.name,
          id: character.character_model_id,
          thumbnail: character.thumbnail_url
        });
      }

      if (onClose) {
        onClose();
      }

    } catch (err) {
      console.error('[VRoid Model Picker] Failed to load character:', err);
      setError('モデルの読み込みに失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 次のページを読み込み
  const handleLoadMore = () => {
    if (!loading && hasMore && characters.length > 0) {
      // 最後のキャラクターのIDを次のmax_idとして使用
      const lastCharacterId = characters[characters.length - 1].id;
      loadCharacters(lastCharacterId);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0 }}>VRoid Hub</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666',
              padding: '5px 10px'
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* 認証前 */}
        {!isAuthenticated && !loading && (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              VRoid Hubのキャラクターを使用するには<br />
              VRoid Hubアカウントで認証が必要です
            </p>
            <button onClick={handleLogin}>
              <i className="fas fa-sign-in-alt" style={{ marginRight: '8px' }}></i>
              VRoid Hubで認証
            </button>
          </div>
        )}

        {/* 認証済み - キャラクター一覧 */}
        {isAuthenticated && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                {characters.length}件のキャラクター
              </p>
              <button onClick={handleLogout} style={{
                background: 'rgba(0,0,0,0.1)',
                fontSize: '13px',
                padding: '6px 12px'
              }}>
                <i className="fas fa-sign-out-alt" style={{ marginRight: '5px' }}></i>
                ログアウト
              </button>
            </div>

            {/* キャラクターグリッド */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '15px'
            }}>
              {characters.map((character) => (
                <div
                  key={character.id}
                  onClick={() => handleSelectCharacter(character)}
                  style={{
                    cursor: 'pointer',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#9C27B0';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(156, 39, 176, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <img
                    src={character.thumbnail_url || character.image_url}
                    alt={character.name}
                    style={{
                      width: '100%',
                      height: '140px',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                  <div style={{ padding: '8px' }}>
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#333'
                    }}>
                      {character.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* もっと読み込む */}
            {hasMore && (
              <div style={{ textAlign: 'center' }}>
                <button onClick={handleLoadMore} disabled={loading}>
                  {loading ? '読み込み中...' : 'もっと読み込む'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ローディング表示 */}
        {loading && !characters.length && (
          <div style={{
            textAlign: 'center',
            padding: '30px 20px',
            color: '#666',
            fontSize: '14px'
          }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }}></i>
            <p style={{ margin: 0 }}>読み込み中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
