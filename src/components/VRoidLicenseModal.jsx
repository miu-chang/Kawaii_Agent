import { useState } from 'react';

/**
 * VRoid Hubモデルのライセンス情報表示モーダル
 * VRoid Hub規約準拠: モデル利用前に利用条件を表示し、ユーザーの承諾を得る
 */
export default function VRoidLicenseModal({ isOpen, character, characterization, onAccept, onCancel }) {
  const [hasReadAll, setHasReadAll] = useState(false);

  if (!isOpen || !character || !characterization) return null;

  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (isAtBottom && !hasReadAll) {
      setHasReadAll(true);
    }
  };

  // VRoid Hubライセンスラベルのマッピング
  const getLicenseLabel = (key, value) => {
    const labels = {
      avatar_use: 'アバターとしての利用',
      violent_expression: '暴力表現',
      sexual_expression: '性的表現',
      corporate_commercial_use: '法人の商用利用',
      personal_commercial_use: '個人の商用利用',
      redistribution: '再配布',
      attribution: 'クレジット表記',
      modification: '改変'
    };

    const values = {
      true: '許可',
      false: '禁止',
      required: '必要',
      unnecessary: '不要'
    };

    return {
      label: labels[key] || key,
      value: values[String(value)] || String(value)
    };
  };

  // ライセンス情報を取得
  const license = characterization?.characterization?.character_model_license || {};

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
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333'
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '22px' }}>
          モデル利用条件の確認
        </h2>

        <p style={{ margin: '0 0 20px 0', color: '#999', fontSize: '13px' }}>
          このモデルを使用する前に、利用条件を確認してください
        </p>

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

          {/* キャラクター情報 */}
          <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #333' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              marginBottom: '15px'
            }}>
              {character.thumbnail_url && (
                <img
                  src={character.thumbnail_url}
                  alt={character.name}
                  style={{
                    width: '80px',
                    height: '80px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '2px solid #444'
                  }}
                />
              )}
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '18px' }}>
                  {character.name}
                </h3>
                {characterization?.characterization?.author_name && (
                  <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
                    作者: {characterization.characterization.author_name}
                  </p>
                )}
              </div>
            </div>

            {characterization?.characterization?.description && (
              <p style={{ margin: '10px 0 0 0', color: '#aaa', fontSize: '13px' }}>
                {characterization.characterization.description}
              </p>
            )}
          </div>

          {/* ライセンス条件 */}
          <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>
            利用条件
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(license).map(([key, value]) => {
              const { label, value: displayValue } = getLicenseLabel(key, value);

              // 許可/禁止/必要/不要の色分け
              const valueColor =
                displayValue === '許可' || displayValue === '不要' ? '#4ade80' :
                displayValue === '禁止' || displayValue === '必要' ? '#f87171' :
                '#94a3b8';

              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 15px',
                    backgroundColor: '#111',
                    borderRadius: '6px',
                    border: '1px solid #222'
                  }}
                >
                  <span style={{ color: '#ddd', fontSize: '14px' }}>{label}</span>
                  <span style={{
                    color: valueColor,
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>

          {/* VRoid Hubリンク */}
          <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #333' }}>
            <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '12px' }}>
              詳細な利用条件は VRoid Hub でご確認ください
            </p>
            <a
              href={`https://hub.vroid.com/characters/${character.character_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#60a5fa',
                fontSize: '12px',
                textDecoration: 'underline'
              }}
            >
              VRoid Hubでモデルを見る
            </a>
          </div>

          {/* 注意事項 */}
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1a1a2e', borderRadius: '6px', border: '1px solid #2a2a4e' }}>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '12px', lineHeight: '1.6' }}>
              ⚠️ このモデルを使用することで、上記の利用条件に同意したものとみなされます。
              利用条件に違反した場合、モデルの使用が制限される可能性があります。
            </p>
          </div>
        </div>

        {/* ボタン */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '12px 24px',
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#333'}
          >
            キャンセル
          </button>
          <button
            onClick={onAccept}
            disabled={!hasReadAll}
            style={{
              padding: '12px 24px',
              backgroundColor: hasReadAll ? '#60a5fa' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: hasReadAll ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: hasReadAll ? 1 : 0.5,
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (hasReadAll) e.target.style.backgroundColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              if (hasReadAll) e.target.style.backgroundColor = '#60a5fa';
            }}
          >
            {hasReadAll ? '利用条件に同意して使用する' : '最後までスクロールしてください'}
          </button>
        </div>
      </div>
    </div>
  );
}
