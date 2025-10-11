import React, { useState, useEffect } from 'react';
import { Device } from '@capacitor/device';
import { VRMode } from './VRMode';
import { ARMode } from './ARMode';
import { ARInteraction } from './ARInteraction';

/**
 * 統合XRモードセレクター
 * スマホ1台で全対応：
 * - 通常モード（デフォルト）
 * - ARモード（カメラで現実にキャラ配置）
 * - VRモード（安いゴーグルでステレオ表示）
 * - MRモード（VR + カメラパススルー）
 */
export function XRModeSelector({
  threeRenderer,
  scene,
  camera,
  mmdModel,
  vrmModel,
  onPlaceCharacter,
  onInteraction,
  enableHandTracking = false,
  onVRStateChange
}) {
  const [currentMode, setCurrentMode] = useState('normal'); // normal / ar / vr / mr
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [xrCapabilities, setXRCapabilities] = useState({
    webxr: false,
    ar: false,
    vr: false,
    mr: false
  });
  const [placedCharacters, setPlacedCharacters] = useState([]);

  // デバイス情報とXR対応チェック
  useEffect(() => {
    const checkCapabilities = async () => {
      const info = await Device.getInfo();
      setDeviceInfo(info);

      const capabilities = {
        webxr: 'xr' in navigator,
        ar: false,
        vr: false,
        mr: false
      };

      if (navigator.xr) {
        // AR対応チェック
        capabilities.ar = await navigator.xr.isSessionSupported('immersive-ar');
        // VR対応チェック
        capabilities.vr = await navigator.xr.isSessionSupported('immersive-vr');
        // MR対応チェック（AR機能があればMRも可能）
        capabilities.mr = capabilities.ar || capabilities.vr;
      }

      setXRCapabilities(capabilities);
      console.log('[XRModeSelector] Device:', info.platform);
      console.log('[XRModeSelector] Capabilities:', capabilities);
    };

    checkCapabilities();
  }, []);

  // モード切り替え
  const switchMode = (mode) => {
    console.log('[XRModeSelector] Switching to mode:', mode);
    setCurrentMode(mode);
    setShowModeSelector(false);
  };

  // モード情報
  const modes = [
    {
      id: 'normal',
      name: '通常モード',
      icon: '🖥️',
      description: 'デスクトップコンパニオン',
      available: true
    },
    {
      id: 'ar',
      name: 'ARモード',
      icon: '📱',
      description: 'カメラで現実世界にキャラ配置',
      available: true,
      requirements: 'スマホカメラ必須'
    },
    {
      id: 'vr',
      name: 'VRモード',
      icon: '🥽',
      description: 'VRゴーグルでステレオ表示',
      available: true,
      requirements: 'VRゴーグル推奨（なくてもOK）'
    },
    {
      id: 'mr',
      name: 'MRモード',
      icon: '✨',
      description: 'VR + カメラで現実に重ねる',
      available: xrCapabilities.mr || xrCapabilities.ar,
      requirements: 'VRゴーグル + カメラ'
    }
  ];

  return (
    <>
      {/* モード切り替えボタン */}
      <button
        onClick={() => setShowModeSelector(!showModeSelector)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: '3px solid rgba(255,255,255,0.3)',
          color: '#fff',
          fontSize: '32px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
      >
        {modes.find(m => m.id === currentMode)?.icon || '🎮'}
      </button>

      {/* モード選択パネル */}
      {showModeSelector && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '320px',
          maxHeight: '70vh',
          background: 'rgba(20, 20, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 10001,
          overflowY: 'auto'
        }}>
          <h3 style={{
            color: '#fff',
            margin: '0 0 20px 0',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            XRモード選択
          </h3>

          {/* 現在のモード */}
          <div style={{
            background: 'rgba(102, 126, 234, 0.2)',
            padding: '12px',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px' }}>
              現在のモード
            </div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
              {modes.find(m => m.id === currentMode)?.icon} {modes.find(m => m.id === currentMode)?.name}
            </div>
          </div>

          {/* モード一覧 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => mode.available && switchMode(mode.id)}
                disabled={!mode.available}
                style={{
                  background: mode.id === currentMode
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : mode.available
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(100,100,100,0.1)',
                  border: mode.id === currentMode
                    ? '2px solid rgba(255,255,255,0.5)'
                    : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: mode.available ? 'pointer' : 'not-allowed',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  opacity: mode.available ? 1 : 0.5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>{mode.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}>
                      {mode.name}
                    </div>
                    <div style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: '12px',
                      marginBottom: '4px'
                    }}>
                      {mode.description}
                    </div>
                    {mode.requirements && (
                      <div style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '10px',
                        fontStyle: 'italic'
                      }}>
                        💡 {mode.requirements}
                      </div>
                    )}
                  </div>
                  {mode.id === currentMode && (
                    <div style={{
                      color: '#4ade80',
                      fontSize: '20px'
                    }}>
                      ✓
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* デバイス情報 */}
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)'
          }}>
            <div>📱 デバイス: {deviceInfo?.platform || 'Unknown'}</div>
            <div>🌐 WebXR: {xrCapabilities.webxr ? '✓' : '✗'}</div>
            <div>📱 AR対応: {xrCapabilities.ar ? '✓' : '✗'}</div>
            <div>🥽 VR対応: {xrCapabilities.vr ? '✓' : '✗'}</div>
          </div>

          {/* 閉じるボタン */}
          <button
            onClick={() => setShowModeSelector(false)}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            閉じる
          </button>
        </div>
      )}

      {/* 現在のモードに応じたコンポーネント表示 */}
      {currentMode === 'ar' && (
        <>
          <ARMode
            scene={scene}
            camera={camera}
            mmdModel={mmdModel}
            vrmModel={vrmModel}
            isEnabled={true}
            onToggle={(enabled) => !enabled && setCurrentMode('normal')}
            onPlaceCharacter={(character) => {
              setPlacedCharacters(prev => [...prev, character]);
              if (onPlaceCharacter) onPlaceCharacter(character);
            }}
            placedCharacters={placedCharacters}
            setPlacedCharacters={setPlacedCharacters}
          />
          <ARInteraction
            scene={scene}
            camera={camera}
            placedCharacters={placedCharacters}
            onInteraction={onInteraction}
            enableHandTracking={enableHandTracking}
          />
        </>
      )}

      {(currentMode === 'vr' || currentMode === 'mr') && (
        <VRMode
          threeRenderer={threeRenderer}
          scene={scene}
          camera={camera}
          isEnabled={true}
          enableMR={currentMode === 'mr'}
          onToggle={(enabled) => !enabled && setCurrentMode('normal')}
          onVRStateChange={onVRStateChange}
        />
      )}

      {/* モード説明（初回のみ表示） */}
      {currentMode !== 'normal' && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '12px',
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 9999,
          maxWidth: '90%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {currentMode === 'ar' && '📱 ARモード: カメラを向けて床をタップ'}
          {currentMode === 'vr' && '🥽 VRモード: スマホをゴーグルに装着'}
          {currentMode === 'mr' && '✨ MRモード: VRゴーグル装着後カメラ有効化'}
        </div>
      )}
    </>
  );
}
