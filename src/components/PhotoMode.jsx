import React, { useState, useRef, useEffect } from 'react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as THREE from 'three';

export function PhotoMode({ threeRenderer, scene, camera, onMotionChange, isVisible, onClose }) {
  const [filter, setFilter] = useState('none');
  const [frame, setFrame] = useState(null);
  const [pose, setPose] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const canvasRef = useRef(null);
  const previewImageRef = useRef(null);

  // ========================================
  // スクリーンショット撮影
  // ========================================

  const captureScreenshot = async () => {
    if (!threeRenderer || !scene || !camera) {
      console.error('[PhotoMode] Renderer, scene, or camera not available');
      return null;
    }

    try {
      // 高解像度でレンダリング
      const originalSize = threeRenderer.getSize(new THREE.Vector2());
      const pixelRatio = window.devicePixelRatio || 1;

      // 一時的に解像度上げる（2倍）
      threeRenderer.setSize(
        originalSize.x * 2,
        originalSize.y * 2,
        false
      );
      threeRenderer.render(scene, camera);

      // Canvas to DataURL
      const dataUrl = threeRenderer.domElement.toDataURL('image/png');

      // 元のサイズに戻す
      threeRenderer.setSize(originalSize.x, originalSize.y, false);

      return dataUrl;
    } catch (error) {
      console.error('[PhotoMode] Screenshot capture failed:', error);
      return null;
    }
  };

  // ========================================
  // フィルター適用
  // ========================================

  const applyFilter = (imageData, filterType) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        switch (filterType) {
          case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
              const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
              data[i] = data[i + 1] = data[i + 2] = avg;
            }
            break;

          case 'sepia':
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
              data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
              data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
            }
            break;

          case 'brighten':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, data[i] + 30);
              data[i + 1] = Math.min(255, data[i + 1] + 30);
              data[i + 2] = Math.min(255, data[i + 2] + 30);
            }
            break;

          case 'contrast':
            const factor = 1.5;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
              data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
              data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
            }
            break;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageData;
    });
  };

  // ========================================
  // フレーム合成
  // ========================================

  const addFrame = async (imageData, frameType) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // フレーム描画
        ctx.strokeStyle = frameType === 'heart' ? '#ff69b4' : '#ffffff';
        ctx.lineWidth = 20;

        if (frameType === 'rounded') {
          const radius = 30;
          ctx.beginPath();
          ctx.moveTo(radius, 0);
          ctx.lineTo(canvas.width - radius, 0);
          ctx.arcTo(canvas.width, 0, canvas.width, radius, radius);
          ctx.lineTo(canvas.width, canvas.height - radius);
          ctx.arcTo(canvas.width, canvas.height, canvas.width - radius, canvas.height, radius);
          ctx.lineTo(radius, canvas.height);
          ctx.arcTo(0, canvas.height, 0, canvas.height - radius, radius);
          ctx.lineTo(0, radius);
          ctx.arcTo(0, 0, radius, 0, radius);
          ctx.stroke();
        }

        // ウォーターマーク
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Kawaii Agent', 20, canvas.height - 20);

        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageData;
    });
  };

  // ========================================
  // SNS共有
  // ========================================

  const sharePhoto = async (imageData) => {
    try {
      // Filesystemに保存
      const fileName = `kawaii_agent_${Date.now()}.png`;
      const base64Data = imageData.split(',')[1];

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      // 共有ダイアログ
      await Share.share({
        title: 'Kawaii Agent フォト',
        text: 'AIコンパニオンと撮った写真！',
        url: result.uri,
        dialogTitle: '共有する'
      });

      console.log('[PhotoMode] Shared successfully');
    } catch (error) {
      console.error('[PhotoMode] Share failed:', error);
      // Webの場合はダウンロード
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `kawaii_agent_${Date.now()}.png`;
      link.click();
    }
  };

  // ========================================
  // ポーズ変更
  // ========================================

  const changePose = async (poseName) => {
    const poses = {
      peace: 'wave',
      thinking: 'thinking',
      happy: 'joy',
      cute: 'clap'
    };

    setPose(poseName);
    if (onMotionChange && poses[poseName]) {
      onMotionChange(poses[poseName]);
    }
  };

  // ========================================
  // メイン撮影処理
  // ========================================

  const takePhoto = async () => {
    setIsCapturing(true);
    try {
      let photo = await captureScreenshot();
      if (!photo) {
        console.error('[PhotoMode] Failed to capture screenshot');
        setIsCapturing(false);
        return;
      }

      if (filter !== 'none') {
        photo = await applyFilter(photo, filter);
      }

      if (frame) {
        photo = await addFrame(photo, frame);
      }

      // プレビュー表示
      previewImageRef.current = photo;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const img = new Image();
        img.onload = () => {
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = photo;
      }

      await sharePhoto(photo);
    } catch (error) {
      console.error('[PhotoMode] Photo capture failed:', error);
    }
    setIsCapturing(false);
  };

  // ========================================
  // UI
  // ========================================

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ヘッダー */}
      <div style={{ padding: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>📸 フォトモード</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer', padding: '0' }}>×</button>
      </div>

      {/* プレビューエリア */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '90%', maxHeight: '70vh', borderRadius: '8px' }} />
      </div>

      {/* コントロールパネル */}
      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.1)', maxHeight: '40vh', overflowY: 'auto' }}>
        {/* ポーズ選択 */}
        <div style={{ marginBottom: '15px' }}>
          <p style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>ポーズ:</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
            {['peace', 'thinking', 'happy', 'cute'].map(p => (
              <button
                key={p}
                onClick={() => changePose(p)}
                style={{
                  padding: '10px 20px',
                  background: pose === p ? '#4a9eff' : 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* フィルター選択 */}
        <div style={{ marginBottom: '15px' }}>
          <p style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>フィルター:</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
            {['none', 'grayscale', 'sepia', 'brighten', 'contrast'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '10px 20px',
                  background: filter === f ? '#4a9eff' : 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* フレーム選択 */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>フレーム:</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
            {[null, 'rounded', 'heart'].map(fr => (
              <button
                key={fr || 'none'}
                onClick={() => setFrame(fr)}
                style={{
                  padding: '10px 20px',
                  background: frame === fr ? '#4a9eff' : 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {fr || 'なし'}
              </button>
            ))}
          </div>
        </div>

        {/* 撮影ボタン */}
        <button
          onClick={takePhoto}
          disabled={isCapturing}
          style={{
            width: '100%',
            padding: '20px',
            background: isCapturing ? '#666' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: isCapturing ? 'not-allowed' : 'pointer'
          }}
        >
          {isCapturing ? '処理中...' : '📸 撮影して共有'}
        </button>
      </div>
    </div>
  );
}
