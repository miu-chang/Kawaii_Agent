import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Device } from '@capacitor/device';

/**
 * ARモードコンポーネント（ハイブリッド方式）
 * - Android: WebXR（LiDAR不要、カメラのみで深度検出）
 * - iOS: AR.js（マーカーベース）
 */
export function ARMode({
  scene,
  camera,
  mmdModel,
  vrmModel,
  isEnabled,
  onToggle,
  onPlaceCharacter,
  placedCharacters,
  setPlacedCharacters
}) {
  const [platform, setPlatform] = useState(null);
  const [isARActive, setIsARActive] = useState(false);
  const [arType, setArType] = useState(null); // 'webxr' or 'arjs'
  // placedCharactersはpropsから受け取る
  const arSessionRef = useRef(null);
  const hitTestSourceRef = useRef(null);
  const reticleRef = useRef(null);

  // プラットフォーム検出
  useEffect(() => {
    const detectPlatform = async () => {
      const info = await Device.getInfo();
      setPlatform(info.platform);
      console.log('[ARMode] Platform:', info.platform);

      // iOS判定
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const supportsWebXR = 'xr' in navigator && navigator.xr;

      if (!isIOS && supportsWebXR) {
        // Android: WebXR
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        if (supported) {
          setArType('webxr');
          console.log('[ARMode] WebXR AR supported');
        }
      } else if (isIOS) {
        // iOS: AR.js（マーカーベース）
        setArType('arjs');
        console.log('[ARMode] Using AR.js for iOS');
      }
    };

    detectPlatform();
  }, []);

  // ========================================
  // WebXR AR（Android）
  // ========================================

  const initWebXR = async () => {
    if (!navigator.xr) {
      console.error('[ARMode] WebXR not supported');
      return;
    }

    try {
      // AR セッション開始
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['depth-sensing', 'dom-overlay'],
        domOverlay: { root: document.body }
      });

      arSessionRef.current = session;
      setIsARActive(true);

      console.log('[ARMode] WebXR AR session started');

      // レンダラーをXRに設定
      const gl = session.renderState.baseLayer?.context;
      if (gl) {
        // XRセッションにレンダラーを接続
        session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      }

      // リファレンススペース取得
      const referenceSpace = await session.requestReferenceSpace('local');

      // ヒットテストソース作成
      const viewerSpace = await session.requestReferenceSpace('viewer');
      hitTestSourceRef.current = await session.requestHitTestSource({ space: viewerSpace });

      // レティクル（配置マーカー）作成
      createReticle();

      // レンダーループ
      const onXRFrame = (time, frame) => {
        session.requestAnimationFrame(onXRFrame);

        const pose = frame.getViewerPose(referenceSpace);
        if (!pose) return;

        // ヒットテスト実行
        if (hitTestSourceRef.current) {
          const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const hitPose = hit.getPose(referenceSpace);

            if (hitPose && reticleRef.current) {
              // レティクル位置更新
              reticleRef.current.visible = true;
              reticleRef.current.position.setFromMatrixPosition(hitPose.transform.matrix);
            }
          } else if (reticleRef.current) {
            reticleRef.current.visible = false;
          }
        }

        // 深度情報取得（オクルージョン用）
        const view = pose.views[0];
        const depthInfo = frame.getDepthInformation(view);
        if (depthInfo) {
          console.log('[ARMode] Depth information available');
          // オクルージョンシェーダーに深度情報を渡す
          // shader.uniforms.depthTexture = depthInfo.texture;
        }
      };

      session.requestAnimationFrame(onXRFrame);

      // セッション終了リスナー
      session.addEventListener('end', () => {
        setIsARActive(false);
        arSessionRef.current = null;
        console.log('[ARMode] WebXR AR session ended');
      });

    } catch (error) {
      console.error('[ARMode] WebXR initialization failed:', error);
    }
  };

  // レティクル作成
  const createReticle = () => {
    if (!scene) return;

    const geometry = new THREE.RingGeometry(0.1, 0.12, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;

    scene.add(reticle);
    reticleRef.current = reticle;

    console.log('[ARMode] Reticle created');
  };

  // キャラクター配置（タップ時）
  const placeCharacter = () => {
    if (!reticleRef.current || !reticleRef.current.visible) return;

    const position = reticleRef.current.position.clone();

    // モデルをクローンして配置
    let characterClone;
    if (mmdModel) {
      // MMDモデルのクローン
      characterClone = mmdModel.clone();
    } else if (vrmModel) {
      // VRMモデルのクローン
      characterClone = vrmModel.scene.clone();
    }

    if (characterClone) {
      characterClone.position.copy(position);
      scene.add(characterClone);

      setPlacedCharacters(prev => [...prev, characterClone]);
      console.log('[ARMode] Character placed at:', position);

      if (onPlaceCharacter) {
        onPlaceCharacter(characterClone, position);
      }
    }
  };

  // ========================================
  // AR.js（iOS）
  // ========================================

  const initARjs = () => {
    console.log('[ARMode] AR.js mode (marker-based)');
    setIsARActive(true);

    // AR.jsの初期化は別途実装が必要
    // マーカーベースなので、マーカー画像を用意する必要がある
    alert('AR.jsモード: マーカーをカメラに向けてください');
  };

  // ========================================
  // AR開始/終了
  // ========================================

  const startAR = () => {
    if (arType === 'webxr') {
      initWebXR();
    } else if (arType === 'arjs') {
      initARjs();
    }
  };

  const stopAR = () => {
    if (arSessionRef.current) {
      arSessionRef.current.end();
    }
    setIsARActive(false);

    // レティクル削除
    if (reticleRef.current && scene) {
      scene.remove(reticleRef.current);
      reticleRef.current = null;
    }

    // 配置したキャラクター削除
    placedCharacters.forEach(char => {
      if (scene) {
        scene.remove(char);
      }
    });
    setPlacedCharacters([]);
  };

  // タップイベント
  useEffect(() => {
    if (!isARActive) return;

    const handleTap = () => {
      if (arType === 'webxr') {
        placeCharacter();
      }
    };

    document.addEventListener('click', handleTap);

    return () => {
      document.removeEventListener('click', handleTap);
    };
  }, [isARActive, arType]);

  // ========================================
  // UI
  // ========================================

  if (!isEnabled || !arType) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '140px',
      right: '20px',
      zIndex: 1000
    }}>
      {/* ARボタン */}
      <button
        onClick={isARActive ? stopAR : startAR}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: isARActive
            ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
          border: 'none',
          color: '#fff',
          fontSize: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isARActive ? '🔴' : '📱'}
      </button>

      {/* AR説明 */}
      {isARActive && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 10000,
          maxWidth: '90%'
        }}>
          {arType === 'webxr' ? (
            <>
              📱 ARモード有効<br />
              <small>床をスキャンして、緑の円をタップ</small>
            </>
          ) : (
            <>
              📱 ARマーカーモード<br />
              <small>マーカーをカメラに向けてください</small>
            </>
          )}
        </div>
      )}

      {/* 配置数表示 */}
      {isARActive && placedCharacters.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          zIndex: 10000
        }}>
          配置: {placedCharacters.length}体
        </div>
      )}
    </div>
  );
}
