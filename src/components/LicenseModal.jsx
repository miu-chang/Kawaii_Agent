import { useState, useEffect } from 'react';
import licenseApi from '../services/licenseApi';

export default function LicenseModal({ isOpen, onClose, onLicenseActivated }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (isOpen && licenseApi.hasValidLicense()) {
      loadUsage();
    }
  }, [isOpen]);

  const loadUsage = async () => {
    const usageData = await licenseApi.getUsage();
    setUsage(usageData);
  };

  const handleVerify = async () => {
    setError('');
    setIsVerifying(true);

    try {
      const result = await licenseApi.verifyLicense(licenseKey.trim());

      if (result.success) {
        if (onLicenseActivated) {
          onLicenseActivated(result.info);
        }
        await loadUsage();
        setLicenseKey('');
      } else {
        setError(result.error || 'ライセンスキーが無効です');
      }
    } catch (err) {
      setError('ライセンス認証に失敗しました: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemove = () => {
    if (confirm('ライセンスを削除しますか？')) {
      licenseApi.clearLicense();
      setUsage(null);
      if (onLicenseActivated) {
        onLicenseActivated(null);
      }
    }
  };

  if (!isOpen) return null;

  const hasLicense = licenseApi.hasValidLicense();
  const info = licenseApi.getLicenseInfo();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>ライセンス管理</h2>

        {hasLicense ? (
          // ライセンスが登録済み
          <div>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>現在のライセンス</h3>
              <div style={styles.infoRow}>
                <span>プラン:</span>
                <span style={styles.planBadge}>{info?.plan?.toUpperCase()}</span>
              </div>
              <div style={styles.infoRow}>
                <span>有効期限:</span>
                <span>{info?.expiresAt ? new Date(info.expiresAt).toLocaleDateString('ja-JP') : '-'}</span>
              </div>
            </div>

            {usage && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>今月の使用量</h3>
                <div style={styles.progressContainer}>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min((usage.tokensUsed / usage.tokensLimit) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <div style={styles.usageText}>
                    {usage.tokensUsed.toLocaleString()} / {usage.tokensLimit.toLocaleString()} トークン
                  </div>
                  <div style={styles.remainingText}>
                    残り: {usage.tokensRemaining.toLocaleString()} トークン
                  </div>
                </div>
              </div>
            )}

            <div style={styles.buttonRow}>
              <button
                style={styles.removeButton}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 107, 107, 0.5)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255, 107, 107, 0.3)'}
                onClick={handleRemove}
              >
                ライセンスを削除
              </button>
              <button
                style={styles.closeButton}
                onMouseEnter={(e) => e.target.style.background = 'rgba(100, 100, 100, 0.5)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(100, 100, 100, 0.3)'}
                onClick={onClose}
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
          // ライセンス未登録
          <div>
            <p style={styles.description}>
              ライセンスキーを入力してAI機能を有効化してください
            </p>

            <input
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              onFocus={(e) => e.target.style.borderColor = 'rgba(100, 200, 255, 0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              style={styles.input}
              disabled={isVerifying}
            />

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.buttonRow}>
              <button
                style={{
                  ...styles.verifyButton,
                  ...(isVerifying && styles.buttonDisabled)
                }}
                onMouseEnter={(e) => !isVerifying && (e.target.style.background = 'rgba(78, 204, 163, 0.5)')}
                onMouseLeave={(e) => !isVerifying && (e.target.style.background = 'rgba(78, 204, 163, 0.3)')}
                onClick={handleVerify}
                disabled={isVerifying || !licenseKey.trim()}
              >
                {isVerifying ? '認証中...' : 'ライセンスを認証'}
              </button>
              <button
                style={styles.closeButton}
                onMouseEnter={(e) => e.target.style.background = 'rgba(100, 100, 100, 0.5)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(100, 100, 100, 0.3)'}
                onClick={onClose}
              >
                キャンセル
              </button>
            </div>

            <div style={styles.footer}>
              <p style={styles.footerText}>
                ライセンスは<a href="https://booth.pm" target="_blank" style={styles.link}>BOOTH</a>で購入できます
              </p>
            </div>

            {/* ロードマップ */}
            <div style={styles.roadmapSection}>
              <h3 style={styles.roadmapTitle}>
                <i className="fas fa-map" style={{ marginRight: '8px' }}></i>
                開発ロードマップ
              </h3>
              <div style={styles.roadmapItem}>
                <i className="fas fa-mobile-alt" style={styles.roadmapIcon}></i>
                <div style={styles.roadmapContent}>
                  <div style={styles.roadmapLabel}>モバイル対応</div>
                  <div style={styles.roadmapDesc}>iOS/Android向けアプリ開発中</div>
                </div>
              </div>
              <div style={styles.roadmapItem}>
                <i className="fas fa-globe" style={styles.roadmapIcon}></i>
                <div style={styles.roadmapContent}>
                  <div style={styles.roadmapLabel}>クロスプラットフォーム</div>
                  <div style={styles.roadmapDesc}>Web版・モバイル版でもご利用可能に</div>
                </div>
              </div>
              <div style={styles.roadmapItem}>
                <i className="fas fa-laptop" style={styles.roadmapIcon}></i>
                <div style={styles.roadmapContent}>
                  <div style={styles.roadmapLabel}>ライセンス共有</div>
                  <div style={styles.roadmapDesc}>1つのライセンスで複数デバイス利用可能（台数制限あり）</div>
                </div>
              </div>
              <p style={styles.roadmapNote}>
                <i className="fas fa-info-circle" style={{ marginRight: '5px' }}></i>
                既存のライセンスで新機能もご利用いただけます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000
  },
  modal: {
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '22px',
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold'
  },
  section: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: 'rgba(100, 200, 255, 0.9)',
    fontWeight: 'bold',
    letterSpacing: '0.5px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '14px'
  },
  planBadge: {
    background: 'linear-gradient(90deg, rgba(78, 204, 163, 0.5), rgba(100, 200, 255, 0.5))',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#ffffff'
  },
  progressContainer: {
    marginTop: '12px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, rgba(78, 204, 163, 0.8), rgba(100, 200, 255, 0.8))',
    transition: 'width 0.3s ease'
  },
  usageText: {
    color: '#ffffff',
    fontSize: '13px',
    marginBottom: '4px'
  },
  remainingText: {
    color: 'rgba(78, 204, 163, 0.9)',
    fontSize: '12px'
  },
  description: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '16px',
    textAlign: 'center',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '16px',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: '12px',
    boxSizing: 'border-box',
    transition: 'all 0.2s'
  },
  error: {
    color: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: '12px',
    borderRadius: '12px',
    marginBottom: '12px',
    fontSize: '13px',
    border: '1px solid rgba(255, 107, 107, 0.3)'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px'
  },
  verifyButton: {
    flex: 1,
    padding: '12px 24px',
    background: 'rgba(78, 204, 163, 0.3)',
    color: '#ffffff',
    border: '1px solid rgba(78, 204, 163, 0.5)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  removeButton: {
    flex: 1,
    padding: '12px 24px',
    background: 'rgba(255, 107, 107, 0.3)',
    color: '#ffffff',
    border: '1px solid rgba(255, 107, 107, 0.5)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  closeButton: {
    flex: 1,
    padding: '12px 24px',
    background: 'rgba(100, 100, 100, 0.3)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  footer: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '12px',
    textAlign: 'center',
    margin: 0
  },
  link: {
    color: 'rgba(100, 200, 255, 0.9)',
    textDecoration: 'none'
  },
  roadmapSection: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: 'rgba(100, 150, 255, 0.05)',
    border: '1px solid rgba(100, 150, 255, 0.2)',
    borderRadius: '12px'
  },
  roadmapTitle: {
    margin: '0 0 16px 0',
    fontSize: '15px',
    color: 'rgba(100, 200, 255, 0.9)',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center'
  },
  roadmapItem: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '12px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  roadmapIcon: {
    color: 'rgba(100, 200, 255, 0.8)',
    fontSize: '18px',
    marginRight: '12px',
    marginTop: '2px',
    minWidth: '18px'
  },
  roadmapContent: {
    flex: 1
  },
  roadmapLabel: {
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '4px'
  },
  roadmapDesc: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '11px',
    lineHeight: '1.4'
  },
  roadmapNote: {
    marginTop: '12px',
    marginBottom: 0,
    padding: '8px',
    color: 'rgba(78, 204, 163, 0.9)',
    fontSize: '11px',
    textAlign: 'center',
    backgroundColor: 'rgba(78, 204, 163, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(78, 204, 163, 0.2)'
  }
};
