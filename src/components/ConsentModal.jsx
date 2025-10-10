import { useState } from 'react';

export default function ConsentModal({ isOpen, onAccept }) {
  const [hasReadAll, setHasReadAll] = useState(false);

  if (!isOpen) return null;

  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (isAtBottom && !hasReadAll) {
      setHasReadAll(true);
    }
  };

  const handleAccept = () => {
    localStorage.setItem('termsAccepted', 'true');
    localStorage.setItem('termsAcceptedDate', new Date().toISOString());
    onAccept();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '24px' }}>
          利用規約とプライバシーポリシー
        </h2>

        <div
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: '20px',
            padding: '20px',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            border: '1px solid #333',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#ccc'
          }}>

          <h3 style={{ color: '#fff', marginTop: 0 }}>1. データの収集と使用</h3>
          <p>本アプリケーションは以下のデータを収集・使用します：</p>
          <ul>
            <li><strong>会話内容</strong>: AI応答生成のため、OpenAI APIに送信されます</li>
            <li><strong>音声データ</strong>: 音声認識のため、OpenAI Whisper APIに送信されます（マイク使用時のみ）</li>
            <li><strong>システムプロンプト</strong>: キャラクター設定に使用されます</li>
            <li><strong>ユーザー設定</strong>: 音声、アニメーション、カメラ設定などが保存されます</li>
            <li><strong>ライセンスキー</strong>: BOOTH版のみ、認証に使用されます</li>
          </ul>

          <h3 style={{ color: '#fff' }}>2. データの保存場所</h3>
          <ul>
            <li><strong>ローカル保存</strong>: 会話履歴、設定、インポートしたモデルはお使いのPC内（localStorage/IndexedDB）に保存されます</li>
            <li><strong>外部API</strong>: OpenAI APIは処理中の一時保存のみ（OpenAIのプライバシーポリシーに準拠）</li>
            <li><strong>バックエンドサーバー</strong>: BOOTH版のみ、ライセンス認証情報（ハッシュ化されたキーのみ）が保存されます</li>
          </ul>

          <h3 style={{ color: '#fff' }}>3. データの共有</h3>
          <ul>
            <li><strong>OpenAI</strong>: 会話内容と音声データはAI処理のため送信されます</li>
            <li><strong>その他の第三者</strong>: データは共有されません</li>
          </ul>

          <h3 style={{ color: '#fff' }}>4. 必要な許可</h3>
          <ul>
            <li><strong>インターネット接続</strong>: AI機能の使用に必須です</li>
            <li><strong>マイクアクセス</strong>: 音声入力機能を使用する場合に必要です（任意）</li>
            <li><strong>ファイルアクセス</strong>: モデル・アニメーションのインポートに必要です（任意）</li>
          </ul>

          <h3 style={{ color: '#fff' }}>5. 利用規約</h3>
          <ul>
            <li>個人利用・商用利用が可能です</li>
            <li>アプリケーション自体の再配布は禁止です</li>
            <li>リバースエンジニアリング、逆コンパイル、逆アセンブルは禁止です</li>
            <li>違法行為への使用は厳禁です</li>
          </ul>

          <h3 style={{ color: '#fff' }}>6. ユーザーの権利</h3>
          <ul>
            <li><strong>データの削除</strong>: 設定からローカルストレージをクリアできます</li>
            <li><strong>データのエクスポート</strong>: 会話履歴をエクスポートできます</li>
            <li><strong>利用停止</strong>: アプリをアンインストールすることでいつでも利用を停止できます</li>
          </ul>

          <h3 style={{ color: '#fff' }}>7. セキュリティ</h3>
          <ul>
            <li>ライセンスキーはハッシュ化して保存されます</li>
            <li>OpenAI APIキーはローカルに保存され、外部には送信されません（Git版のみ）</li>
            <li>通信は全てHTTPSで暗号化されます</li>
          </ul>

          <h3 style={{ color: '#fff' }}>8. 第三者サービスのプライバシーポリシー</h3>
          <p>本アプリケーションは以下の第三者サービスを使用します：</p>
          <ul>
            <li><strong>OpenAI</strong>: <a href="https://openai.com/policies/privacy-policy" target="_blank" style={{ color: '#4a9eff' }}>プライバシーポリシー</a></li>
            <li><strong>VOICEVOX</strong>: <a href="https://voicevox.hiroshiba.jp/" target="_blank" style={{ color: '#4a9eff' }}>公式サイト</a></li>
          </ul>

          <h3 style={{ color: '#fff' }}>9. お問い合わせ</h3>
          <p>プライバシーに関するご質問は以下にお問い合わせください：</p>
          <ul>
            <li>Email: weiyu.illustration2002@gmail.com</li>
            <li>Discord: <a href="https://discord.gg/fsZaFkDDrU" target="_blank" style={{ color: '#4a9eff' }}>https://discord.gg/fsZaFkDDrU</a></li>
          </ul>

          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '20px 0' }} />

          <p style={{ fontSize: '12px', color: '#888' }}>
            最終更新: 2025年10月
          </p>

          {!hasReadAll && (
            <p style={{
              color: '#ff9900',
              fontWeight: 'bold',
              textAlign: 'center',
              marginTop: '20px',
              fontSize: '13px'
            }}>
              ↓ 最後までスクロールして内容をご確認ください ↓
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleAccept}
            disabled={!hasReadAll}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: hasReadAll ? '#4a9eff' : '#333',
              color: hasReadAll ? '#fff' : '#666',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: hasReadAll ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (hasReadAll) {
                e.target.style.backgroundColor = '#3a8eef';
              }
            }}
            onMouseLeave={(e) => {
              if (hasReadAll) {
                e.target.style.backgroundColor = '#4a9eff';
              }
            }}
          >
            同意してアプリを使用する
          </button>
        </div>

        <p style={{
          marginTop: '15px',
          fontSize: '12px',
          color: '#888',
          textAlign: 'center'
        }}>
          同意することで、上記の利用規約とプライバシーポリシーに同意したものとみなされます
        </p>
      </div>
    </div>
  );
}
