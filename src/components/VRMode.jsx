import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';

/**
 * VR/MRモードコンポーネント
 * - スマホVRゴーグル対応（Cardboard等）
 * - ステレオ描画（左右の目用に2画面）
 * - ジャイロセンサーによる視点追従
 * - 擬似MR（VR + カメラパススルー）
 */
export function VRMode({ threeRenderer, scene, camera, isEnabled, enableMR = false, onToggle, onVRStateChange }) {
  const [isVRSupported, setIsVRSupported] = useState(false);
  const [isMRSupported, setIsMRSupported] = useState(false);
  const [isVRActive, setIsVRActive] = useState(false);
  const [cameraPassthrough, setCameraPassthrough] = useState(false);
  const vrButtonRef = useRef(null);
  const stereoCamera = useRef(null);
  const vrSessionRef = useRef(null);
  const videoElementRef = useRef(null);
  const isWebXRSupported = useRef(false);

  useEffect(() => {
    if (!threeRenderer) return;

    // WebXR対応チェック
    if ('xr' in navigator) {
      isWebXRSupported.current = true;
      // VRサポートチェック
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setIsVRSupported(supported);
        console.log('[VRMode] WebXR VR supported:', supported);
      });

      // MR（AR）サポートチェック
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setIsMRSupported(supported);
        console.log('[VRMode] WebXR MR (AR) supported:', supported);
      });
    } else {
      isWebXRSupported.current = false;
      console.log('[VRMode] WebXR not supported, using fallback stereo mode');
      setIsVRSupported(true); // フォールバックモードで有効化
    }

    // VR Button作成
    if (vrButtonRef.current && isVRSupported) {
      const button = VRButton.createButton(threeRenderer);
      vrButtonRef.current.appendChild(button);

      // VRセッション開始/終了イベント
      threeRenderer.xr.addEventListener('sessionstart', () => {
        setIsVRActive(true);
        console.log('[VRMode] VR session started');
      });

      threeRenderer.xr.addEventListener('sessionend', () => {
        setIsVRActive(false);
        console.log('[VRMode] VR session ended');
      });
    }

    return () => {
      if (threeRenderer.xr) {
        threeRenderer.xr.removeEventListener('sessionstart', null);
        threeRenderer.xr.removeEventListener('sessionend', null);
      }
    };
  }, [threeRenderer, isVRSupported]);

  // ステレオカメラ初期化（WebXR非対応時のフォールバック）
  useEffect(() => {
    if (!camera) return;

    // ステレオカメラ作成（左右の目用に2つのカメラ）
    stereoCamera.current = new THREE.StereoCamera();
    stereoCamera.current.aspect = 0.5; // 左右分割なので0.5

    console.log('[VRMode] Stereo camera initialized');
  }, [camera]);

  // VR状態を親に通知
  useEffect(() => {
    if (onVRStateChange) {
      onVRStateChange({
        isActive: isVRActive,
        stereoCamera: stereoCamera.current,
        needsStereoRendering: isVRActive && !isWebXRSupported.current
      });
    }
  }, [isVRActive, onVRStateChange]);

  // カードボードモード（手動ステレオ描画）
  const enableCardboardMode = () => {
    if (!threeRenderer || !scene || !camera || !stereoCamera.current) return;

    console.log('[VRMode] Enabling Cardboard mode...');

    // 全画面表示
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }

    // 画面ロック（横向き固定）
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch((err) => {
        console.log('[VRMode] Screen orientation lock not supported:', err);
      });
    }

    // ステレオレンダリング開始
    setIsVRActive(true);

    // カメラの目の間隔を設定（デフォルト: 0.064m = 64mm）
    stereoCamera.current.eyeSep = 0.064;

    // レンダーループ内でステレオレンダリングを行う必要がある
    // (これはApp.jsxのanimationループ内で処理)
  };

  const disableCardboardMode = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }

    setIsVRActive(false);
    console.log('[VRMode] Cardboard mode disabled');
  };

  const toggleVRMode = () => {
    if (isVRActive) {
      disableCardboardMode();
    } else {
      enableCardboardMode();
    }
  };

  // ========================================
  // MRモード（カメラパススルー）
  // ========================================

  const enableCameraPassthrough = async () => {
    try {
      console.log('[VRMode] Enabling camera passthrough...');

      // カメラストリーム取得
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 背面カメラ
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      // ビデオエレメント作成（背景用）
      if (!videoElementRef.current) {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        video.style.position = 'fixed';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '-1'; // 背景に配置
        document.body.appendChild(video);
        videoElementRef.current = video;
      }

      setCameraPassthrough(true);
      console.log('[VRMode] Camera passthrough enabled');
    } catch (error) {
      console.error('[VRMode] Camera passthrough failed:', error);
      alert('カメラへのアクセスが拒否されました');
    }
  };

  const disableCameraPassthrough = () => {
    if (videoElementRef.current) {
      const stream = videoElementRef.current.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      videoElementRef.current.remove();
      videoElementRef.current = null;
    }
    setCameraPassthrough(false);
    console.log('[VRMode] Camera passthrough disabled');
  };

  // MRモード自動有効化
  useEffect(() => {
    if (enableMR && isVRActive) {
      enableCameraPassthrough();
    } else if (!enableMR && cameraPassthrough) {
      disableCameraPassthrough();
    }

    return () => {
      if (cameraPassthrough) {
        disableCameraPassthrough();
      }
    };
  }, [enableMR, isVRActive]);

  if (!isEnabled) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      zIndex: 1000
    }}>
      {/* VRボタンコンテナ */}
      <div ref={vrButtonRef} style={{ marginBottom: '10px' }} />

      {/* カードボードモードボタン（WebXR非対応時のフォールバック） */}
      {!navigator.xr && (
        <button
          onClick={toggleVRMode}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: isVRActive
              ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
              : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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
          {isVRActive ? '🔴' : '🥽'}
        </button>
      )}

      {/* VRモード説明 */}
      {isVRActive && (
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
          zIndex: 10000
        }}>
          📱 VRモード有効<br />
          <small>VRゴーグルに装着してください</small>
        </div>
      )}
    </div>
  );
}

/**
 * ステレオレンダリングヘルパー
 * App.jsxのアニメーションループから呼び出す
 */
export function renderStereo(renderer, scene, camera, stereoCamera) {
  if (!renderer || !scene || !camera || !stereoCamera) return;

  const width = renderer.domElement.width;
  const height = renderer.domElement.height;

  // ステレオカメラ更新
  stereoCamera.update(camera);

  // 左目レンダリング
  renderer.setScissorTest(true);
  renderer.setScissor(0, 0, width / 2, height);
  renderer.setViewport(0, 0, width / 2, height);
  renderer.render(scene, stereoCamera.cameraL);

  // 右目レンダリング
  renderer.setScissor(width / 2, 0, width / 2, height);
  renderer.setViewport(width / 2, 0, width / 2, height);
  renderer.render(scene, stereoCamera.cameraR);

  renderer.setScissorTest(false);
}
