import { useState } from 'react';

const AboutModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('about');

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflowY: 'auto',
        color: '#ffffff',
        fontFamily: 'sans-serif'
      }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Kawaii Agent について</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #444' }}>
          <button
            onClick={() => setActiveTab('about')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'about' ? '#4a9eff' : '#aaa',
              borderBottom: activeTab === 'about' ? '2px solid #4a9eff' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            アプリについて
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'terms' ? '#4a9eff' : '#aaa',
              borderBottom: activeTab === 'terms' ? '2px solid #4a9eff' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            利用規約
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'privacy' ? '#4a9eff' : '#aaa',
              borderBottom: activeTab === 'privacy' ? '2px solid #4a9eff' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            プライバシー
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'licenses' ? '#4a9eff' : '#aaa',
              borderBottom: activeTab === 'licenses' ? '2px solid #4a9eff' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ライセンス
          </button>
          <button
            onClick={() => setActiveTab('voicevox')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'voicevox' ? '#4a9eff' : '#aaa',
              borderBottom: activeTab === 'voicevox' ? '2px solid #4a9eff' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            VOICEVOX
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          {activeTab === 'about' && (
            <div>
              <h3>Kawaii Agent</h3>
              <p style={{ color: '#aaa' }}>Version 1.0.0</p>
              <p>AIデスクトップコンパニオンアプリ</p>
              <p style={{ marginTop: '20px' }}>
                Kawaii Agentは、AIを搭載したデスクトップマスコットアプリケーションです。
                VRM/MMDモデルを使用して、キャラクターとの対話を楽しめます。
              </p>
              <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#333', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>
                  © 2025 miu-chang (miu sekiguchi). All rights reserved.
                </p>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#aaa' }}>
                <p><strong>お問い合わせ</strong></p>
                <p>Email: weiyu.illustration2002@gmail.com</p>
                <p>
                  Discord: <a href="https://discord.gg/fsZaFkDDrU" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>
                    サポートサーバー
                  </a>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h3>利用規約</h3>
              <div style={{ color: '#ccc' }}>
                <p><strong>1. 本規約について</strong></p>
                <p>本利用規約（以下「本規約」）は、Kawaii Agent（以下「本アプリ」）の利用に関する条件を定めるものです。</p>

                <p><strong>2. 利用許諾</strong></p>
                <p>本アプリは個人利用および商用利用が可能です。ただし、本アプリそのものの再配布は禁止されています。</p>

                <p><strong>3. 禁止事項</strong></p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>本アプリのリバースエンジニアリング、逆コンパイル、逆アセンブル</li>
                  <li>本アプリを使用した違法行為</li>
                  <li>本アプリの機能を悪用する行為</li>
                </ul>

                <p><strong>4. 免責事項</strong></p>
                <p>本アプリの利用により生じたいかなる損害についても、開発者は一切の責任を負いません。</p>

                <p><strong>5. 変更</strong></p>
                <p>開発者は、本規約を予告なく変更することができます。</p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <h3>プライバシーポリシー</h3>
              <div style={{ color: '#ccc' }}>
                <p><strong>1. 収集する情報</strong></p>
                <p>本アプリは以下の情報を収集・使用します：</p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>ユーザーとの対話内容（AIサービス提供のため）</li>
                  <li>音声データ（音声認識機能使用時）</li>
                  <li>ライセンスキー情報</li>
                </ul>

                <p><strong>2. 情報の利用目的</strong></p>
                <p>収集した情報は以下の目的で利用されます：</p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>AIによる対話応答の生成</li>
                  <li>音声認識サービスの提供</li>
                  <li>ライセンス認証および使用量管理</li>
                </ul>

                <p><strong>3. 第三者への提供</strong></p>
                <p>本アプリは以下の外部サービスを利用します：</p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>OpenAI API（対話生成）</li>
                </ul>
                <p style={{ fontSize: '12px', color: '#999' }}>
                  ※ OpenAI APIには、ユーザーの入力データが送信されます。OpenAIのプライバシーポリシーもご確認ください。
                </p>

                <p><strong>4. データの保存</strong></p>
                <p>対話履歴は端末内にのみ保存され、外部サーバーには保存されません。</p>

                <p><strong>5. お問い合わせ</strong></p>
                <p>プライバシーに関するご質問は、以下までお問い合わせください。</p>
                <p style={{ fontSize: '12px' }}>
                  Email: <span style={{ color: '#4a9eff' }}>weiyu.illustration2002@gmail.com</span><br/>
                  Discord: <a href="https://discord.gg/fsZaFkDDrU" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>
                    サポートサーバー
                  </a>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'voicevox' && (
            <div>
              <h3>VOICEVOX 音声ライブラリ</h3>
              <div style={{ color: '#ccc', fontSize: '12px' }}>
                <p>本アプリはVOICEVOXの音声合成機能を利用しています。</p>
                <p style={{ marginTop: '12px' }}><strong>利用規約</strong></p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>商用利用・非商用利用ともに可能</li>
                  <li>クレジット表記必須：「VOICEVOX:キャラクター名」</li>
                  <li>各キャラクターは個別の利用規約に従います</li>
                </ul>

                <h4 style={{ marginTop: '20px' }}>利用可能キャラクター一覧</h4>
                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><p>• 四国めたん</p></div>
                  <div><p>• ずんだもん</p></div>
                  <div><p>• 春日部つむぎ</p></div>
                  <div><p>• 雨晴はう</p></div>
                  <div><p>• 波音リツ</p></div>
                  <div><p>• 玄野武宏</p></div>
                  <div><p>• 白上虎太郎</p></div>
                  <div><p>• 青山龍星</p></div>
                  <div><p>• 冥鳴ひまり</p></div>
                  <div><p>• 九州そら</p></div>
                  <div><p>• もち子さん</p></div>
                  <div><p>• 剣崎雌雄</p></div>
                  <div><p>• WhiteCUL</p></div>
                  <div><p>• 後鬼</p></div>
                  <div><p>• No.7</p></div>
                  <div><p>• ちび式じい</p></div>
                  <div><p>• 櫻歌ミコ</p></div>
                  <div><p>• 小夜/SAYO</p></div>
                  <div><p>• ナースロボ＿タイプＴ</p></div>
                  <div><p>• †聖騎士 紅桜†</p></div>
                  <div><p>• 雀松朱司</p></div>
                  <div><p>• 麒ヶ島宗麟</p></div>
                  <div><p>• 春歌ナナ</p></div>
                  <div><p>• 猫使アル</p></div>
                  <div><p>• 猫使ビィ</p></div>
                  <div><p>• 中国うさぎ</p></div>
                  <div><p>• 栗田まろん</p></div>
                  <div><p>• 東北きりたん</p></div>
                  <div><p>• 東北イタコ</p></div>
                  <div><p>• 東北ずん子</p></div>
                </div>

                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#333', borderRadius: '6px' }}>
                  <p style={{ margin: 0, fontSize: '11px' }}>
                    各キャラクターの詳細な利用規約は<a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>VOICEVOX公式サイト</a>をご確認ください。<br/>
                    クレジット表記例：「VOICEVOX:ずんだもん」
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'licenses' && (
            <div>
              <h3>オープンソースライセンス</h3>
              <div style={{ color: '#ccc', fontSize: '12px' }}>
                <p>本アプリは以下のオープンソースソフトウェアを使用しています：</p>

                <div style={{ marginTop: '16px' }}>
                  <p><strong>Electron</strong> - MIT License</p>
                  <p><strong>React</strong> - MIT License</p>
                  <p><strong>Three.js</strong> - MIT License</p>
                  <p><strong>@pixiv/three-vrm</strong> - MIT License</p>
                  <p><strong>mmd-parser</strong> - MIT License</p>
                  <p><strong>ammojs-typed</strong> - MIT License (物理演算)</p>
                  <p><strong>@ricky0123/vad-web</strong> - ISC License (音声認識)</p>
                </div>

                <h4 style={{ marginTop: '24px' }}>付属3Dモデル</h4>
                <div style={{ marginTop: '12px' }}>
                  <p><strong>アリシア・ソリッド（ニコニ立体ちゃん）</strong></p>
                  <p style={{ fontSize: '11px', color: '#aaa' }}>
                    © Dwango Co., Ltd.<br/>
                    利用条件：個人利用・商用利用可（法人除く）、改変可、クレジット表記不要<br/>
                    <a href="https://3d.nicovideo.jp/alicia/" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>
                      公式サイト
                    </a>
                  </p>
                </div>

                <h4 style={{ marginTop: '24px' }}>付属モーションデータ</h4>
                <div style={{ marginTop: '12px' }}>
                  <p><strong>VRMAアニメーション（64種）</strong></p>
                  <p style={{ fontSize: '11px', color: '#aaa' }}>
                    Adobe Mixamo<br/>
                    VRMA形式に変換して使用<br/>
                    利用条件：個人利用・商用利用可
                  </p>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <p><strong>MMDモーションデータ（17種）</strong></p>
                  <p style={{ fontSize: '11px', color: '#aaa' }}>
                    以下のモーション作成者様の作品を使用しています：
                  </p>
                  <ul style={{ fontSize: '11px', color: '#aaa', marginLeft: '20px', marginTop: '8px' }}>
                    <li>音街ウナ公式モーション © MTK INTERNET Co., Ltd. - 商用利用についてはガイドライン参照
                      <br/><a href="https://otomachiuna.jp/" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff', marginLeft: '20px' }}>公式サイト</a>
                    </li>
                    <li>むつごろう様 - ぼんやり待ちループ、ご機嫌ループ、会話モーション等
                      <br/><a href="https://3d.nicovideo.jp/users/2603791" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff', marginLeft: '20px' }}>ニコニ立体</a>
                    </li>
                    <li>各種MMDモーション作成者様 - 各モーションは個別の利用規約に従います</li>
                  </ul>
                  <p style={{ fontSize: '11px', color: '#aaa', marginTop: '8px' }}>
                    モーションデータの詳細は<a href="https://3d.nicovideo.jp/" target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>ニコニ立体</a>をご確認ください。
                  </p>
                </div>

                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#333', borderRadius: '6px' }}>
                  <p style={{ margin: 0 }}>
                    詳細なライセンス情報は、アプリケーションディレクトリ内の LICENSE ファイルをご確認ください。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
