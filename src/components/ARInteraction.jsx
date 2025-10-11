import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import handTrackingService from '../services/handTrackingService';

/**
 * AR/MRインタラクション統合コンポーネント
 * 1. タッチベース（メイン機能）
 * 2. 手検出ベース（拡張機能）
 */
export function ARInteraction({
  scene,
  camera,
  placedCharacters,
  onInteraction,
  enableHandTracking = false
}) {
  const [handTrackingActive, setHandTrackingActive] = useState(false);
  const [showHandDebug, setShowHandDebug] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const raycaster = useRef(new THREE.Raycaster());
  const handCursorRef = useRef(null); // 手カーソル（3Dオブジェクト）
  const lastInteractionTime = useRef(0);

  // AR空間グラブ用State
  const grabbedBoneRef = useRef(null);
  const grabbedCharacterRef = useRef(null);
  const grabOffsetRef = useRef(new THREE.Vector3());
  const [isGrabbing, setIsGrabbing] = useState(false);

  // ========================================
  // タッチベースインタラクション
  // ========================================

  const handleTouch = (event) => {
    if (placedCharacters.length === 0 || !scene || !camera) return;

    event.preventDefault();
    const touch = event.touches[0] || event.changedTouches[0];

    // タッチ座標を正規化デバイス座標に変換
    const rect = event.target.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    // レイキャスト
    raycaster.current.setFromCamera({ x, y }, camera);

    // 配置された全キャラクターに対してレイキャスト
    const intersects = [];
    placedCharacters.forEach(character => {
      const charIntersects = raycaster.current.intersectObject(character, true);
      if (charIntersects.length > 0) {
        intersects.push({
          character,
          intersect: charIntersects[0]
        });
      }
    });

    if (intersects.length > 0) {
      // 一番近いキャラクターを選択
      intersects.sort((a, b) => a.intersect.distance - b.intersect.distance);
      const { character, intersect } = intersects[0];

      // 部位検出（ボーン名から判定）
      const boneName = intersect.object.parent?.name || intersect.object.name || '';
      const bodyPart = getBoneCategory(boneName);

      console.log('[ARInteraction] Touch detected:', {
        character,
        boneName,
        bodyPart,
        position: intersect.point
      });

      // インタラクションコールバック
      if (onInteraction) {
        onInteraction({
          type: 'tap',
          character,
          bodyPart,
          boneName,
          position: intersect.point
        });
      }
    }
  };

  // ========================================
  // 手検出ベースインタラクション（拡張機能）
  // ========================================

  useEffect(() => {
    if (!enableHandTracking || !scene || !camera) return;

    // ビデオ要素作成
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.style.display = 'none';
      document.body.appendChild(video);
      videoRef.current = video;
    }

    // デバッグキャンバス作成
    if (!canvasRef.current && showHandDebug) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvas.style.position = 'fixed';
      canvas.style.top = '10px';
      canvas.style.right = '10px';
      canvas.style.width = '320px';
      canvas.style.height = '240px';
      canvas.style.border = '2px solid #00ff00';
      canvas.style.zIndex = '10000';
      document.body.appendChild(canvas);
      canvasRef.current = canvas;
    }

    // 手カーソル作成（3D球体）
    if (!handCursorRef.current) {
      const geometry = new THREE.SphereGeometry(0.02, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.7, transparent: true });
      const cursor = new THREE.Mesh(geometry, material);
      cursor.visible = false;
      scene.add(cursor);
      handCursorRef.current = cursor;
    }

    // 手検出初期化
    handTrackingService.initialize(
      videoRef.current,
      canvasRef.current,
      (handsData) => handleHandDetected(handsData)
    ).then(() => {
      handTrackingService.start();
      setHandTrackingActive(true);
    });

    return () => {
      handTrackingService.stop();
      if (handCursorRef.current && scene) {
        scene.remove(handCursorRef.current);
        handCursorRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
      setHandTrackingActive(false);
    };
  }, [enableHandTracking, scene, camera, showHandDebug]);

  const handleHandDetected = (handsData) => {
    if (!scene || !camera || !handCursorRef.current || placedCharacters.length === 0) return;

    // 両手検出（抱きしめジェスチャー）
    const leftHand = handsData.find(h => h.handedness === 'Left');
    const rightHand = handsData.find(h => h.handedness === 'Right');

    if (leftHand && rightHand) {
      // 両手が検出された場合、抱きしめジェスチャーをチェック
      const leftPos = handTrackingService.convertToARCoordinates(leftHand, camera, 1.0);
      const rightPos = handTrackingService.convertToARCoordinates(rightHand, camera, 1.0);

      if (leftPos && rightPos) {
        const leftVec = new THREE.Vector3(leftPos.x, leftPos.y, leftPos.z);
        const rightVec = new THREE.Vector3(rightPos.x, rightPos.y, rightPos.z);
        const handsDistance = leftVec.distanceTo(rightVec);

        // 両手が近い（30cm以内）& 開いた手 → 抱きしめる
        if (handsDistance < 0.3 && leftHand.isOpenHand && rightHand.isOpenHand) {
          // 両手の中心位置
          const centerPos = new THREE.Vector3()
            .addVectors(leftVec, rightVec)
            .multiplyScalar(0.5);

          const closestCharacter = findClosestCharacter(centerPos, 0.5);

          if (closestCharacter && onInteraction) {
            const now = Date.now();
            if (now - lastInteractionTime.current > 2000) { // 2秒クールダウン
              console.log('[ARInteraction] Hug gesture detected');
              onInteraction({
                type: 'hug',
                character: closestCharacter,
                bodyPart: 'default',
                boneName: 'both-hands-hug',
                position: centerPos
              });
              lastInteractionTime.current = now;
            }
          }
          // 両手検出時はカーソル非表示
          handCursorRef.current.visible = false;
          return;
        }
      }
    }

    // 右手の人差し指を使用（片手ジェスチャー）
    if (!rightHand) {
      handCursorRef.current.visible = false;
      // グラブ解除
      if (isGrabbing) {
        releaseGrab();
      }
      return;
    }

    // 2D座標→3D AR座標変換
    const arPosition = handTrackingService.convertToARCoordinates(
      rightHand,
      camera,
      1.0 // 1m先に配置
    );

    if (arPosition) {
      const handPos = new THREE.Vector3(arPosition.x, arPosition.y, arPosition.z);

      // 手カーソル表示
      handCursorRef.current.position.copy(handPos);
      handCursorRef.current.visible = true;

      // ========================================
      // ジェスチャー別処理
      // ========================================

      // 1. 握った手（グラブ）- スカート・髪を掴んで引っ張る
      if (rightHand.isFist) {
        if (!isGrabbing) {
          // グラブ開始
          startGrab(handPos);
        } else {
          // グラブ中 - ボーンを手の位置に追従させる
          updateGrab(handPos);
        }
      } else if (isGrabbing) {
        // 手を開いたらグラブ解除
        releaseGrab();
      }

      // 2. 開いた手（撫でる）
      else if (rightHand.isOpenHand && !rightHand.isWaving) {
        const now = Date.now();
        if (now - lastInteractionTime.current > 300) { // 300msクールダウン
          checkHandCollision(handPos, 'pet');
          lastInteractionTime.current = now;
        }
      }

      // 3. 手を振る（挨拶）
      else if (rightHand.isWaving) {
        const now = Date.now();
        if (now - lastInteractionTime.current > 1000) { // 1秒クールダウン
          handleWaveGesture(handPos);
          lastInteractionTime.current = now;
        }
      }

      // 4. ピンチ（タップ）
      else if (rightHand.isPinching) {
        const now = Date.now();
        if (now - lastInteractionTime.current > 500) { // 500msクールダウン
          checkHandCollision(handPos, 'tap');
          lastInteractionTime.current = now;
        }
      }
    }
  };

  // ========================================
  // グラブ機能
  // ========================================

  const startGrab = (handPosition) => {
    if (placedCharacters.length === 0) return;

    // 手の位置に最も近いボーンを探す（VRMViewerと同じロジック）
    let closestBone = null;
    let closestCharacter = null;
    let minDistance = Infinity;

    placedCharacters.forEach(character => {
      character.traverse((obj) => {
        if (obj.isBone || obj.type === 'Bone') {
          const boneName = obj.name || '';

          // 除外対象ボーン（目、口、上半身コアなど）
          const isExcluded =
            boneName.includes('目') || boneName.toLowerCase().includes('eye') ||
            boneName.includes('口') || boneName.toLowerCase().includes('mouth') ||
            boneName.includes('上半身') || boneName.toLowerCase().includes('upperbody') ||
            boneName.toLowerCase().includes('chest') || boneName.toLowerCase().includes('spine') ||
            boneName.toLowerCase().includes('torso');

          if (!isExcluded) {
            const boneWorldPos = new THREE.Vector3();
            obj.getWorldPosition(boneWorldPos);
            const distance = handPosition.distanceTo(boneWorldPos);

            if (distance < 0.2 && distance < minDistance) { // 20cm以内
              closestBone = obj;
              closestCharacter = character;
              minDistance = distance;
            }
          }
        }
      });
    });

    if (closestBone) {
      grabbedBoneRef.current = closestBone;
      grabbedCharacterRef.current = closestCharacter;

      // グラブオフセット計算
      const bonePos = new THREE.Vector3();
      closestBone.getWorldPosition(bonePos);
      grabOffsetRef.current.subVectors(bonePos, handPosition);

      setIsGrabbing(true);
      console.log('[ARInteraction] Grabbed bone:', closestBone.name);

      // ハプティクスフィードバック（可能なら）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  };

  const updateGrab = (handPosition) => {
    if (!grabbedBoneRef.current) return;

    // 手の位置 + オフセット = ボーンの新しい位置
    const targetPos = new THREE.Vector3().addVectors(handPosition, grabOffsetRef.current);

    // ボーンのローカル座標系に変換
    const bone = grabbedBoneRef.current;
    const parent = bone.parent;

    if (parent) {
      // ワールド座標→親のローカル座標に変換
      const parentWorldMatrix = new THREE.Matrix4();
      parent.getWorldMatrix(parentWorldMatrix);
      const parentWorldMatrixInv = new THREE.Matrix4().copy(parentWorldMatrix).invert();

      const localPos = targetPos.clone().applyMatrix4(parentWorldMatrixInv);

      // ボーン位置更新
      bone.position.copy(localPos);
    } else {
      bone.position.copy(targetPos);
    }
  };

  const releaseGrab = () => {
    if (grabbedBoneRef.current) {
      const boneName = grabbedBoneRef.current.name;
      const bodyPart = getBoneCategory(boneName);

      console.log('[ARInteraction] Released bone:', boneName, 'bodyPart:', bodyPart);

      // インタラクションコールバック（掴んだ反応）
      if (onInteraction) {
        onInteraction({
          type: 'grab',
          character: grabbedCharacterRef.current,
          bodyPart,
          boneName,
          position: new THREE.Vector3()
        });
      }
    }

    grabbedBoneRef.current = null;
    grabbedCharacterRef.current = null;
    setIsGrabbing(false);

    // ハプティクスフィードバック
    if (navigator.vibrate) {
      navigator.vibrate([30, 10, 30]);
    }
  };

  // 挨拶ジェスチャー
  const handleWaveGesture = (handPosition) => {
    const closestCharacter = findClosestCharacter(handPosition, 0.5); // 50cm以内

    if (closestCharacter && onInteraction) {
      console.log('[ARInteraction] Wave gesture detected');
      onInteraction({
        type: 'wave',
        character: closestCharacter,
        bodyPart: 'default',
        boneName: 'hand-wave',
        position: handPosition
      });
    }
  };

  const checkHandCollision = (handPosition, interactionType = 'tap') => {
    if (placedCharacters.length === 0) return;

    const closestCharacter = findClosestCharacter(handPosition, 0.3); // 30cm以内

    if (closestCharacter && onInteraction) {
      console.log('[ARInteraction] Hand collision detected:', interactionType);
      onInteraction({
        type: interactionType,
        character: closestCharacter,
        bodyPart: 'default',
        boneName: 'hand-detected',
        position: handPosition
      });
    }
  };

  const findClosestCharacter = (position, maxDistance = 0.5) => {
    let closestCharacter = null;
    let minDistance = Infinity;

    placedCharacters.forEach(character => {
      const charPosition = new THREE.Vector3();
      character.getWorldPosition(charPosition);
      const distance = position.distanceTo(charPosition);

      if (distance < maxDistance && distance < minDistance) {
        closestCharacter = character;
        minDistance = distance;
      }
    });

    return closestCharacter;
  };

  // ========================================
  // ユーティリティ
  // ========================================

  // ボーン名から部位カテゴリを判定（VRM + MMD対応）
  // VRMViewerと同じロジックを使用
  const getBoneCategory = (boneName) => {
    if (!boneName) return 'default';

    const lower = boneName.toLowerCase();

    // 親密な部位（胸/腰/太もも/尻）
    if (lower.includes('chest') || lower.includes('spine') ||
        lower.includes('hips') || lower.includes('upperleg') ||
        lower.includes('上半身') || lower.includes('下半身') ||
        lower.includes('腰') || lower.includes('胸') || lower.includes('尻') ||
        boneName === '左足' || boneName === '右足' ||
        lower.includes('太もも')) {
      return 'intimate';
    }

    // 頭部
    if (lower.includes('head') || lower.includes('neck') ||
        lower.includes('頭') || lower.includes('首')) {
      return 'head';
    }

    // 肩
    if (lower.includes('shoulder') || lower.includes('肩')) {
      return 'shoulder';
    }

    // 腕/手
    if (lower.includes('arm') || lower.includes('hand') ||
        lower.includes('腕') || lower.includes('手')) {
      return 'arm';
    }

    // 脛/足
    if (lower.includes('leg') || lower.includes('foot') ||
        lower.includes('脛') || (lower.includes('足') && boneName !== '左足' && boneName !== '右足')) {
      return 'leg';
    }

    return 'default';
  };

  // ========================================
  // UI
  // ========================================

  useEffect(() => {
    // タッチイベント登録
    document.addEventListener('touchstart', handleTouch);
    document.addEventListener('touchend', handleTouch);

    return () => {
      document.removeEventListener('touchstart', handleTouch);
      document.removeEventListener('touchend', handleTouch);
    };
  }, [placedCharacters, scene, camera]);

  return (
    <>
      {/* 手検出ステータス */}
      {enableHandTracking && handTrackingActive && (
        <div style={{
          position: 'fixed',
          top: '60px',
          right: '20px',
          background: 'rgba(0, 200, 0, 0.8)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 10001
        }}>
          🤚 手検出: 有効
        </div>
      )}

      {/* デバッグ切り替えボタン */}
      {enableHandTracking && (
        <button
          onClick={() => setShowHandDebug(!showHandDebug)}
          style={{
            position: 'fixed',
            top: '100px',
            right: '20px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            zIndex: 10001
          }}
        >
          {showHandDebug ? '🐛 デバッグ非表示' : '🐛 デバッグ表示'}
        </button>
      )}
    </>
  );
}
