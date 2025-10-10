import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { VRM, VRMSchema, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMAnimation, createVRMAnimationClip, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { MMDLoader } from 'three/examples/jsm/loaders/MMDLoader';
import { MMDAnimationHelper } from 'three/examples/jsm/animation/MMDAnimationHelper';
import { MMDPhysics } from 'three/examples/jsm/animation/MMDPhysics';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { OrbitControls, Environment } from '@react-three/drei';
import AmmoLib from 'ammojs-typed';
import * as THREE from 'three';
import { IdleMotion, PresetMotions, MouseFollower } from '../utils/vrmMotions';
import { GestureManager } from '../utils/vrmGestures';
import { IdleAnimationManager } from '../utils/vrmIdleAnimations';
import { VRMAAnimationManager } from '../utils/vrmaLoader';
import aiService from '../services/aiService';

// Ammo.js初期化（グローバル）- OOM対策：大きなヒープサイズを確保
let AmmoInstance = null;
AmmoLib({
  // 256MBのヒープを確保（デフォルトの16-32MBから大幅増加）
  TOTAL_MEMORY: 256 * 1024 * 1024,
  // メモリの自動拡張を許可（必要に応じてさらに増える）
  ALLOW_MEMORY_GROWTH: true
}).then((lib) => {
  AmmoInstance = lib;
  window.Ammo = lib; // MMDAnimationHelperがグローバルAmmoを参照する
  console.log('[Ammo.js] Physics engine initialized with 256MB heap (expandable)');
}).catch((error) => {
  console.error('[Ammo.js] Failed to initialize with large heap, trying default:', error);
  // 大きなヒープで失敗した場合はデフォルト設定で再試行
  return AmmoLib();
}).then((lib) => {
  if (lib && !AmmoInstance) {
    AmmoInstance = lib;
    window.Ammo = lib;
    console.log('[Ammo.js] Physics engine initialized with default settings');
  }
});

// 部位ごとの表情パターン定義（BlendShapeパラメータ直接指定）
const BODY_PART_REACTIONS = {
  intimate: [ // 胸/腰/太もも
    { name: 'shy', params: { blink: 0.7, ih: 0.2 } },      // 恥ずかしい（目を伏せて微笑み）
    { name: 'angry', params: { blink: 0.3, ou: 0.5 } },    // ちょっと怒り（睨む感じ）
    { name: 'surprised', params: { aa: 0.6, blink: 0.0 } } // 驚き（目と口を開ける）
  ],
  head: [ // 頭
    { name: 'happy', params: { ih: 0.6, blink: 0.3 } },   // 照れ笑顔
    { name: 'shy', params: { blink: 0.9, ih: 0.3 } }      // 強い照れ（目を閉じて笑顔）
  ],
  shoulder: [ // 肩
    { name: 'neutral', params: { blink: 0.2 } }           // 普通（軽い瞬き）
  ],
  arm: [ // 腕/手
    { name: 'happy', params: { ih: 0.5, blink: 0.2 } },   // 嬉しそう
    { name: 'surprised', params: { aa: 0.4, oh: 0.2 } }   // 少し驚き
  ],
  leg: [ // 脛/足
    { name: 'surprised', params: { aa: 0.5, oh: 0.3 } },  // 不思議そう
    { name: 'confused', params: { ou: 0.3, blink: 0.4 } } // 困惑
  ],
  default: [ // その他
    { name: 'neutral', params: { blink: 0.2 } }
  ]
};

// ボーン名から部位カテゴリを判定（VRM + MMD対応）
const getBoneCategory = (boneName) => {
  if (!boneName) return 'default';

  const lower = boneName.toLowerCase();

  // スカート（揺れもの）
  // MMD: スカート
  if (lower.includes('スカート') || lower.includes('skirt')) {
    return 'skirt';
  }

  // 髪（揺れもの）
  // VRM/MMD: 髪, hair
  if (lower.includes('髪') || lower.includes('hair')) {
    return 'hair';
  }

  // リボン・アクセサリー（揺れもの）
  // MMD: リボン, ribbon
  if (lower.includes('リボン') || lower.includes('ribbon')) {
    return 'accessory';
  }

  // 親密な部位（胸/腰/太もも/尻）
  // VRM: chest, spine, hips, upperleg
  // MMD: 上半身, 上半身2, 下半身, 腰, 胸, 胸先, 左胸, 右胸, 左胸先, 右胸先, お尻, 足（太もも部分）
  if (lower.includes('chest') || lower.includes('spine') ||
      lower.includes('hips') || lower.includes('upperleg') ||
      lower.includes('上半身') || lower.includes('下半身') ||
      lower.includes('腰') || lower.includes('胸') || lower.includes('尻') ||
      boneName === '左足' || boneName === '右足' ||
      lower.includes('太もも')) {
    return 'intimate';
  }

  // 頭
  // VRM: head, neck
  // MMD: 頭, 首
  if (lower.includes('head') || lower.includes('neck') ||
      lower.includes('頭') || lower.includes('首')) {
    return 'head';
  }

  // 肩
  // VRM: shoulder, upperarm
  // MMD: 肩, 上腕
  if (lower.includes('shoulder') || lower.includes('upperarm') ||
      lower.includes('肩') || lower.includes('上腕')) {
    return 'shoulder';
  }

  // 腕/手
  // VRM: lowerarm, hand, wrist, finger
  // MMD: 腕, ひじ, 手首, 手, 指
  if (lower.includes('lowerarm') || lower.includes('hand') || lower.includes('wrist') || lower.includes('finger') ||
      lower.includes('腕') || lower.includes('ひじ') || lower.includes('手首') || lower.includes('手') || lower.includes('指')) {
    return 'arm';
  }

  // 脛/足
  // VRM: lowerleg, foot, toe
  // MMD: ひざ, 足首, つま先, すね
  if (lower.includes('lowerleg') || lower.includes('foot') || lower.includes('toe') ||
      lower.includes('ひざ') || lower.includes('足首') || lower.includes('つま先') || lower.includes('すね')) {
    return 'leg';
  }

  return 'default';
};


// カメラ設定反映用の小コンポーネント（毎レンダー/変更時にthreeカメラ更新）
function CameraConfigApplier({ cameraConfig }) {
  const { camera, size } = useThree();

  // カメラ設定の適用
  useEffect(() => {
    if (!camera) return;
    if (Array.isArray(cameraConfig?.position)) {
      camera.position.set(...cameraConfig.position);
    }
    if (Array.isArray(cameraConfig?.lookAt)) {
      camera.lookAt(
        cameraConfig.lookAt[0] ?? 0,
        cameraConfig.lookAt[1] ?? 1,
        cameraConfig.lookAt[2] ?? 0
      );
    }
    if (typeof cameraConfig?.fov === 'number' && camera.fov !== cameraConfig.fov) {
      camera.fov = cameraConfig.fov;
      camera.updateProjectionMatrix();
    }
  }, [cameraConfig, camera]);

  // リサイズ時のアスペクト比とFOV調整
  useEffect(() => {
    if (!camera || !camera.isPerspectiveCamera) return;

    const aspectRatio = size.width / size.height;
    camera.aspect = aspectRatio;

    // 基準FOVを取得（設定されているFOVまたはデフォルト50）
    const baseFov = cameraConfig?.fov || 50;

    // アスペクト比に応じてFOVを調整（FOVを小さくしてキャラクターを大きく表示）
    // 縦長（aspect < 1）の場合はFOVを小さくしてキャラクターを大きく表示
    if (aspectRatio < 1) {
      // 縦長の場合、FOVを小さくする（0.75倍でキャラクターが大きくなる）
      camera.fov = baseFov * 0.75;
    } else if (aspectRatio < 1.2) {
      // ほぼ正方形に近い場合も少しFOVを小さく（0.9倍）
      camera.fov = baseFov * 0.9;
    } else {
      // 横長の場合は基準FOVの0.85倍
      camera.fov = baseFov * 0.85;
    }

    camera.updateProjectionMatrix();
  }, [camera, size, cameraConfig]);

  return null;
}

// Camera interaction overlay (left-drag move, right-drag rotate, wheel zoom)
function CameraInteractionOverlay({ cameraConfig, onCameraChange }) {
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef(null); // どのボタンでドラッグ中か
  const lastPosRef = useRef({ x: 0, y: 0 });
  const yawRef = useRef(0); // 水平方向角度
  const pitchRef = useRef(0); // 垂直方向角度
  const distanceRef = useRef( (cameraConfig?.position ? Math.max(0.1, Math.hypot(cameraConfig.position[0], cameraConfig.position[2])) : 2.5) );
  const targetRef = useRef(cameraConfig?.lookAt || [0,1,0]);
  const positionRef = useRef(cameraConfig?.position || [0, 1.4, 2.5]);

  // 初期角度推定
  useEffect(() => {
    if (Array.isArray(cameraConfig?.position)) {
      const [x,y,z] = cameraConfig.position;
      positionRef.current = [x, y, z];
      distanceRef.current = Math.max(0.1, Math.sqrt(x*x + (z*z)));
      yawRef.current = Math.atan2(x, z);
      pitchRef.current = Math.atan2(y - targetRef.current[1], Math.sqrt(x*x + z*z));
    }
  }, []);

  const updateCameraFromRotation = () => {
    const dist = distanceRef.current;
    const yaw = yawRef.current;
    const pitch = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, pitchRef.current));
    const cx = Math.sin(yaw) * dist;
    const cz = Math.cos(yaw) * dist;
    const cy = targetRef.current[1] + Math.tan(pitch) * dist;
    // positionRefも更新（パン移動との整合性のため）
    positionRef.current = [cx, cy, cz];
    if (onCameraChange) {
      onCameraChange({
        position: [cx, cy, cz],
        lookAt: [...targetRef.current],
        fov: cameraConfig?.fov || 50
      });
    }
  };

  const updateCameraFromPosition = () => {
    if (onCameraChange) {
      onCameraChange({
        position: [...positionRef.current],
        lookAt: [...targetRef.current],
        fov: cameraConfig?.fov || 50
      });
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const handlePointerDown = (e) => {
    if (e.button === 0 || e.button === 2) { // 左または右クリック
      isDraggingRef.current = true;
      dragButtonRef.current = e.button;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };

    if (dragButtonRef.current === 0) {
      // 左ドラッグ: パン移動（カメラの右方向・上方向に沿って平行移動）
      const panSpeed = 0.005;

      // カメラの向きベクトル
      const direction = new THREE.Vector3(
        targetRef.current[0] - positionRef.current[0],
        targetRef.current[1] - positionRef.current[1],
        targetRef.current[2] - positionRef.current[2]
      ).normalize();

      // カメラの右方向ベクトル
      const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

      // カメラの上方向ベクトル
      const up = new THREE.Vector3().crossVectors(right, direction).normalize();

      // パン移動を適用（左右反転）
      positionRef.current[0] -= right.x * dx * panSpeed - up.x * dy * panSpeed;
      positionRef.current[1] -= right.y * dx * panSpeed - up.y * dy * panSpeed;
      positionRef.current[2] -= right.z * dx * panSpeed - up.z * dy * panSpeed;

      // lookAtも同時に移動（パン移動）
      targetRef.current[0] -= right.x * dx * panSpeed - up.x * dy * panSpeed;
      targetRef.current[1] -= right.y * dx * panSpeed - up.y * dy * panSpeed;
      targetRef.current[2] -= right.z * dx * panSpeed - up.z * dy * panSpeed;

      // 回転系の参照値を同期（パン移動後に回転操作が正しく動作するように）
      const [x, y, z] = positionRef.current;
      const [tx, ty, tz] = targetRef.current;
      distanceRef.current = Math.max(0.1, Math.sqrt((x - tx) * (x - tx) + (z - tz) * (z - tz)));
      yawRef.current = Math.atan2(x - tx, z - tz);
      pitchRef.current = Math.atan2(y - ty, Math.sqrt((x - tx) * (x - tx) + (z - tz) * (z - tz)));

      updateCameraFromPosition();
    } else if (dragButtonRef.current === 2) {
      // 右ドラッグ: 回転
      const rotSpeed = 0.005;
      yawRef.current -= dx * rotSpeed;
      pitchRef.current -= dy * rotSpeed;
      updateCameraFromRotation();
    }
  };

  const handlePointerUp = (e) => {
    if (e.button === 0 || e.button === 2) {
      isDraggingRef.current = false;
      dragButtonRef.current = null;
    }
  };

  const handleWheel = (e) => {
    // スクロールでズーム
    const delta = e.deltaY;
    const zoomFactor = 1 + (delta > 0 ? 0.1 : -0.1);
    distanceRef.current = Math.max(0.2, distanceRef.current * zoomFactor);
    updateCameraFromRotation();
  };

  useEffect(() => {
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <div
      style={{ position: 'absolute', inset: 0, cursor: 'grab', pointerEvents: 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    />
  );
}

// VRMモデルコンポーネント
function VRMModel({ url, onLoad, enableMouseFollow = true, enableInteraction = true, onMotionReady, emotion = 'neutral', emotionIntensity = 0.5, isTyping = false, gesture = null, isSpeaking = false, currentSpeechText = '', cameraConfig = { position: [0,1.4,2.5], fov: 50, lookAt: [0,1,0] }, onInteraction, enableCameraFollow = false, onCameraChange, overlayBlendRatio = 1.0, onTapEffect, vrmScale = 1.0 }) {
  const { scene, camera, gl } = useThree();
  const vrmRef = useRef();
  const gestureManagerRef = useRef();
  const idleAnimationManagerRef = useRef();
  const vrmaAnimationManagerRef = useRef();
  const idleMotionRef = useRef();
  const tapAnimationRef = useRef({
    hitPoint: null,
    startTime: 0,
    affectedBones: []
  });
  const [tapEffects, setTapEffects] = useState([]);
  const presetMotionsRef = useRef();
  const mouseFollowerRef = useRef();
  const clockRef = useRef(new THREE.Clock());
  const blinkTimer = useRef(0);
  const nextBlinkTime = useRef(Math.random() * 3 + 2);
  const isBlinking = useRef(false);
  const mousePosition = useRef({ x: 0, y: 0 });
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });
  const lastAnimationTime = useRef(-1); // VRMAアニメーションのループ検知用
  const currentEmotion = useRef('neutral');
  const targetEmotionValue = useRef(0);
  const hasTriggeredGesture = useRef(false);
  const lastActivityTime = useRef(Date.now());
  const mouthTimer = useRef(0);
  const mouthState = useRef(0); // 0=閉じ, 1=開き
  const lastTapReaction = useRef(0); // タップ反応のクールダウン用

  // GPT-5 nano表情制御用
  const gptExpressionParams = useRef(null); // GPT-5 nanoが生成した表情パラメータ
  const lastSpeechText = useRef(''); // 前回の発話テキスト（重複呼び出し防止）

  // インタラクション関連
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });
  const petStrokes = useRef([]);
  const isPetting = useRef(false);

  // グラブ機能用
  const vrmGrabStateRef = useRef({
    isGrabbing: false,
    grabbedBone: null,
    targetWorldPos: null,
    grabHitDistance: null,
    grabbedBoneOriginalPos: null,
    grabbedBoneOriginalRot: null
  });
  const shyTimer = useRef(0);
  const isShy = useRef(false);
  const lastPetReaction = useRef(0);  // 撫でる反応のクールダウン

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm;

        // VRM 0.xの場合の回転補正
        if (vrm.meta?.metaVersion === '0') {
          VRMUtils.rotateVRM0(vrm);
        }

        scene.add(vrm.scene);
        vrmRef.current = vrm;

        // スケールを適用
        vrm.scene.scale.setScalar(vrmScale);
        console.log('[VRM] Scale applied:', vrmScale);

        // デバッグ用：VRMの構造を確認
        console.log('VRM loaded:', vrm);

        // Humanoidのボーン名を確認
        if (vrm.humanoid?.humanBones) {
          const boneNames = Object.keys(vrm.humanoid.humanBones);
          console.log('Available bones:', boneNames);

          // 胸部のボーンを確認
          const chest = vrm.humanoid.getRawBoneNode('chest');
          console.log('Chest bone:', chest);
        }

        // Expressionを確認
        if (vrm.expressionManager) {
          console.log('Expression manager:', vrm.expressionManager);
          const expressionNames = vrm.expressionManager.expressions?.map(e => e.expressionName);
          console.log('Available expression names:', expressionNames);

          // VRM 1.0の場合はexpressionのキーも確認
          if (vrm.expressionManager.expressionMap) {
            console.log('Expression map keys:', Object.keys(vrm.expressionManager.expressionMap));
          }
        }

        // カメラ位置調整（モデルが見えやすい位置に）
        if (cameraConfig?.position) {
          if (Array.isArray(cameraConfig.position)) camera.position.set(...cameraConfig.position);
        } else {
          camera.position.set(0, 1.4, 2.5);
        }
        try {
          if (Array.isArray(cameraConfig?.lookAt)) {
            camera.lookAt(cameraConfig.lookAt[0] ?? 0, cameraConfig.lookAt[1] ?? 1, cameraConfig.lookAt[2] ?? 0);
          } else {
            camera.lookAt(0, 1, 0);
          }
        } catch (e) {
          console.warn('camera.lookAt failed', e);
        }
        if (cameraConfig && typeof cameraConfig.fov === 'number' && camera.fov !== cameraConfig.fov) {
          camera.fov = cameraConfig.fov;
          camera.updateProjectionMatrix();
        }

        // VRM 1.0のlookAtの初期設定（targetをnullにしてエラーを防ぐ）
        if (vrm.lookAt) {
          vrm.lookAt.target = null;

          // VRMLookAtQuaternionProxy がない場合は作成して追加し、警告と参照漏れを防ぐ
          let lookAtProxy = vrm.scene.children.find((obj) => obj instanceof VRMLookAtQuaternionProxy);
          if (!lookAtProxy) {
            lookAtProxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
            lookAtProxy.name = 'VRMLookAtQuaternionProxy';
            vrm.scene.add(lookAtProxy);
          } else if (!lookAtProxy.name) {
            lookAtProxy.name = 'VRMLookAtQuaternionProxy';
          }
        }

        // すべての表情を初期化（リセット）
        if (vrm.expressionManager) {
          const expressions = ['happy', 'angry', 'sad', 'relaxed', 'neutral', 'surprised'];
          expressions.forEach(exp => {
            if (vrm.expressionManager.setValue) {
              vrm.expressionManager.setValue(exp, 0);
            }
          });
        }

        // デフォルトポーズを設定（自然な立ちポーズ）
        if (vrm.humanoid) {
          const rightUpperArm = vrm.humanoid.getRawBoneNode('rightUpperArm');
          const leftUpperArm = vrm.humanoid.getRawBoneNode('leftUpperArm');
          const rightLowerArm = vrm.humanoid.getRawBoneNode('rightLowerArm');
          const leftLowerArm = vrm.humanoid.getRawBoneNode('leftLowerArm');

          if (rightUpperArm) {
            rightUpperArm.rotation.z = 0.3;
            rightUpperArm.rotation.x = 0.1;
          }
          if (leftUpperArm) {
            leftUpperArm.rotation.z = -0.3;
            leftUpperArm.rotation.x = 0.1;
          }
          if (rightLowerArm) {
            rightLowerArm.rotation.z = 0.1;
          }
          if (leftLowerArm) {
            leftLowerArm.rotation.z = -0.1;
          }

          console.log('Default pose set');
        }

        // ジェスチャーマネージャーを初期化
        gestureManagerRef.current = new GestureManager(vrm);
        console.log('GestureManager initialized');

        // アイドルアニメーションマネージャーを初期化
        idleAnimationManagerRef.current = new IdleAnimationManager(vrm);
        console.log('IdleAnimationManager initialized');

        // VRMAアニメーションマネージャーを初期化
        vrmaAnimationManagerRef.current = new VRMAAnimationManager(vrm);
        console.log('VRMAAnimationManager initialized');

        // テスト用にonMotionReadyコールバックでVRMAマネージャーを公開
        if (onMotionReady) {
          onMotionReady({
            vrmaManager: vrmaAnimationManagerRef.current
          });
        }

        // シンプルな呼吸アニメーションのみテスト
        // idleMotionRef.current = new IdleMotion(vrm);
        // presetMotionsRef.current = new PresetMotions(vrm);
        // if (enableMouseFollow) {
        //   mouseFollowerRef.current = new MouseFollower(vrm);
        // }

        if (onLoad) onLoad(vrm);
        // if (onMotionReady) {
        //   onMotionReady({
        //     wave: () => presetMotionsRef.current?.wave(),
        //     nod: () => presetMotionsRef.current?.nod(),
        //     jump: () => presetMotionsRef.current?.jump(),
        //     dance: () => presetMotionsRef.current?.dance()
        //   });
        // }
      },
      (progress) => console.log('Loading...', (progress.loaded / progress.total) * 100, '%'),
      (error) => console.error('Error loading VRM:', error)
    );

    return () => {
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
      }
    };
  }, [url, scene, camera]); // 依存配列を最小限に（モデル再読み込みを防ぐ）

  // マウス追従の設定（別useEffectで管理）
  useEffect(() => {
    const handleMouseMove = (event) => {
      // モーション再生中でもマウス追従を有効にする
      if (enableMouseFollow) {
        // -1 to 1の範囲に正規化
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = -(event.clientY / window.innerHeight) * 2 + 1;

        mousePosition.current.x = x;
        mousePosition.current.y = y;

        // ターゲット回転角を計算
        targetRotation.current.y = x * 0.5;
        targetRotation.current.x = y * 0.3;  // 符号を反転して上下を修正

        // デバッグ：マウスイベントが検出されているか確認（1%の確率）
        if (Math.random() < 0.01) {
          console.log('[MouseEvent] clientX:', event.clientX, 'clientY:', event.clientY,
                      'normalized x:', x.toFixed(3), 'y:', y.toFixed(3),
                      'target rotX:', targetRotation.current.x.toFixed(3), 'rotY:', targetRotation.current.y.toFixed(3));
        }

        // 撫でる動作の検出（クールダウン付き）
        const now = Date.now();
        const lastPos = lastMousePos.current;

        // 10秒に1回だけ反応する（パフォーマンス対策）
        const canReact = (now - lastPetReaction.current) > 10000;

        if (canReact && now - lastPos.time < 100) { // 100ms以内の連続移動
          const dx = event.clientX - lastPos.x;
          const dy = event.clientY - lastPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 5) { // 十分な移動距離
            petStrokes.current.push({ dx, dy, time: now });

            // 古いストロークを削除（500ms以上前）
            petStrokes.current = petStrokes.current.filter(s => now - s.time < 500);

            // 連続したストロークが5つ以上あれば撫でていると判定（閾値を上げてパフォーマンス改善）
            if (petStrokes.current.length >= 5) {
              isPetting.current = true;
              lastPetReaction.current = now;  // クールダウン開始

              // 嬉しい表情をトリガー（ジェスチャーなし、表情のみ）
              if (!isShy.current && vrmRef.current?.expressionManager) {
                currentEmotion.current = 'happy';
                targetEmotionValue.current = 1;

                // 即座に笑顔表情を強く適用
                const expressionManager = vrmRef.current.expressionManager;
                if (expressionManager.setValue) {
                  expressionManager.setValue('happy', 1.0);  // 最大値で笑顔
                  // 口を開いて笑顔
                  try {
                    expressionManager.setValue('aa', 0.4);
                  } catch (_) {}
                }
                console.log('[Interaction] Petting detected - showing strong happy expression');

                // インタラクションコールバックを呼ぶ（音声反応）
                if (onInteraction) {
                  onInteraction('pet');
                }
              }

              // ストロークをクリア
              petStrokes.current = [];
            }
          }
        }

        lastMousePos.current = { x: event.clientX, y: event.clientY, time: now };
      }

      // グラブモード判定と追従処理
      if (isDragging && !vrmGrabStateRef.current.isGrabbing && !grabStarted) {
        const grabDuration = Date.now() - dragStartTime;

        // 500ms以上長押しでグラブモード開始
        if (grabDuration >= 500 && vrmRef.current && grabHitPoint) {
          console.log('[VRM Grab] Starting grab mode');
          grabStarted = true;
          isGrabbing = true;

          // 掴むボーンを特定（hitPointから最も近いボーンを探す）
          const vrm = vrmRef.current;
          if (vrm.scene) {
            let minDistance = Infinity;

            // 掴んではいけないボーンかどうか判定（ブラックリスト方式）
            const isUngrabableBone = (bone) => {
              const name = bone.name || '';
              const lower = name.toLowerCase();

              // 顔のパーツ（目、眉、口など）
              if (lower.includes('目') || lower.includes('eye') ||
                  lower.includes('眉') || lower.includes('brow') ||
                  lower.includes('口') || lower.includes('mouth') ||
                  lower.includes('lip') || lower.includes('唇') ||
                  lower.includes('まぶた') || lower.includes('eyelid')) {
                return true;
              }

              // 頭、首
              if (lower.includes('head') || lower.includes('頭') ||
                  lower.includes('neck') || lower.includes('首')) {
                return true;
              }

              // 体幹（上半身、下半身、背骨）※胸・腰・肩は除外
              if (lower.includes('spine') || lower.includes('背') ||
                  lower.includes('上半身') || lower.includes('下半身') ||
                  lower.includes('pelvis') || lower.includes('骨盤')) {
                return true;
              }

              return false;
            };

            // 全ボーンを走査してhitPointに最も近いものを探す
            vrm.scene.traverse((obj) => {
              if (obj.isBone || obj.type === 'Bone') {
                if (isUngrabableBone(obj)) return;

                const boneWorldPos = new THREE.Vector3();
                obj.getWorldPosition(boneWorldPos);
                const distance = grabHitPoint.distanceTo(boneWorldPos);

                if (distance < minDistance) {
                  minDistance = distance;
                  grabbedBone = obj;
                }
              }
            });

            if (grabbedBone) {
              // 元の位置と回転を保存
              grabbedBoneOriginalPos = grabbedBone.position.clone();
              grabbedBoneOriginalRot = grabbedBone.quaternion.clone();

              // グラブ状態をRefに保存
              vrmGrabStateRef.current.isGrabbing = true;
              vrmGrabStateRef.current.grabbedBone = grabbedBone;
              vrmGrabStateRef.current.grabHitDistance = grabHitPoint.distanceTo(camera.position);
              vrmGrabStateRef.current.grabbedBoneOriginalPos = grabbedBoneOriginalPos;
              vrmGrabStateRef.current.grabbedBoneOriginalRot = grabbedBoneOriginalRot;

              console.log('[VRM Grab] Grabbed bone:', grabbedBone.name);

              // グラブインタラクションコールバックを呼ぶ
              if (enableInteraction && onInteraction) {
                const bodyPart = getBoneCategory(grabbedBone.name);
                onInteraction({
                  type: 'grab',
                  bodyPart,
                  boneName: grabbedBone.name
                });
              }
            }
          }
        }
      }

      // グラブ中：マウス位置のワールド座標を計算して保存
      if (vrmGrabStateRef.current.isGrabbing && vrmGrabStateRef.current.grabbedBone) {
        const canvas = gl.domElement;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        // レイキャストでマウス位置のワールド座標を取得
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // カメラから一定距離の位置をターゲットとする
        const targetPos = new THREE.Vector3();
        raycaster.ray.at(vrmGrabStateRef.current.grabHitDistance, targetPos);

        // ターゲット位置を保存（useFrame内で適用）
        vrmGrabStateRef.current.targetWorldPos = targetPos;
      }
    };

    let isDragging = false;
    let dragStartPos = null;
    let dragStartTime = 0;

    // グラブ機能用の変数
    let isGrabbing = false;
    let grabbedBone = null;
    let grabbedBoneOriginalPos = null;
    let grabbedBoneOriginalRot = null;
    let grabHitPoint = null;
    let grabStarted = false;
    let grabTimeout = null;

    const handleMouseDown = (event) => {
      if (!vrmRef.current) return;

      // canvas要素でのクリックのみ処理（UIクリックを除外）
      const canvas = gl.domElement;
      if (event.target !== canvas) {
        return;
      }

      // Raycasterでクリック位置を検出
      const raycaster = new THREE.Raycaster();
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(vrmRef.current.scene, true);

      if (intersects.length > 0) {
        console.log('[VRM Interaction] Mouse down on model');
        isDragging = true;
        dragStartPos = { x: event.clientX, y: event.clientY };
        dragStartTime = Date.now();

        // グラブ用の初期情報を保存
        grabHitPoint = intersects[0].point.clone();
        grabStarted = false;
        isGrabbing = false;

        // 500ms後にグラブモードに入る（マウスを動かさなくても動作するように）
        grabTimeout = setTimeout(() => {
          if (isDragging && !vrmGrabStateRef.current.isGrabbing && !grabStarted && vrmRef.current && grabHitPoint) {
            console.log('[VRM Grab] Starting grab mode (timeout)');
            grabStarted = true;
            isGrabbing = true;

            // 掴むボーンを特定（hitPointから最も近いボーンを探す）
            const vrm = vrmRef.current;
            if (vrm.scene) {
              let minDistance = Infinity;

              // 掴んではいけないボーンかどうか判定（ブラックリスト方式）
              const isUngrabableBone = (bone) => {
                const name = bone.name || '';
                const lower = name.toLowerCase();

                // 顔のパーツ（目、眉、口など）
                if (lower.includes('目') || lower.includes('eye') ||
                    lower.includes('眉') || lower.includes('brow') ||
                    lower.includes('口') || lower.includes('mouth') ||
                    lower.includes('lip') || lower.includes('唇') ||
                    lower.includes('まぶた') || lower.includes('eyelid')) {
                  return true;
                }

                // 頭、首
                if (lower.includes('head') || lower.includes('頭') ||
                    lower.includes('neck') || lower.includes('首')) {
                  return true;
                }

                // 体幹（上半身、下半身、背骨）※胸・腰・肩は除外
                if (lower.includes('spine') || lower.includes('背') ||
                    lower.includes('上半身') || lower.includes('下半身') ||
                    lower.includes('pelvis') || lower.includes('骨盤')) {
                  return true;
                }

                return false;
              };

              // 全ボーンを走査してhitPointに最も近いものを探す
              vrm.scene.traverse((obj) => {
                if (obj.isBone || obj.type === 'Bone') {
                  if (isUngrabableBone(obj)) return;

                  const boneWorldPos = new THREE.Vector3();
                  obj.getWorldPosition(boneWorldPos);
                  const distance = grabHitPoint.distanceTo(boneWorldPos);

                  if (distance < minDistance) {
                    minDistance = distance;
                    grabbedBone = obj;
                  }
                }
              });

              if (grabbedBone) {
                // 元の位置と回転を保存
                grabbedBoneOriginalPos = grabbedBone.position.clone();
                grabbedBoneOriginalRot = grabbedBone.quaternion.clone();

                // グラブ状態をRefに保存
                vrmGrabStateRef.current.isGrabbing = true;
                vrmGrabStateRef.current.grabbedBone = grabbedBone;
                vrmGrabStateRef.current.grabHitDistance = grabHitPoint.distanceTo(camera.position);
                vrmGrabStateRef.current.grabbedBoneOriginalPos = grabbedBoneOriginalPos;
                vrmGrabStateRef.current.grabbedBoneOriginalRot = grabbedBoneOriginalRot;

                console.log('[VRM Grab] Grabbed bone:', grabbedBone.name);

                // グラブインタラクションコールバックを呼ぶ
                if (enableInteraction && onInteraction) {
                  const bodyPart = getBoneCategory(grabbedBone.name);
                  onInteraction({
                    type: 'grab',
                    bodyPart,
                    boneName: grabbedBone.name
                  });
                }
              }
            }
          }
        }, 500);
      }
    };

    const handleMouseUp = (event) => {
      // グラブタイマーをクリア
      if (grabTimeout) {
        clearTimeout(grabTimeout);
        grabTimeout = null;
      }

      // グラブ中の場合はリリース処理
      if (vrmGrabStateRef.current.isGrabbing && vrmGrabStateRef.current.grabbedBone && vrmGrabStateRef.current.grabbedBoneOriginalPos) {
        console.log('[VRM Grab] Releasing grabbed bone');

        // アニメーションで元の位置に戻す（ボーンへの参照をローカル変数に保存）
        const boneToAnimate = vrmGrabStateRef.current.grabbedBone;
        const startPos = vrmGrabStateRef.current.grabbedBone.position.clone();
        const startRot = vrmGrabStateRef.current.grabbedBone.quaternion.clone();
        const targetPos = vrmGrabStateRef.current.grabbedBoneOriginalPos;
        const targetRot = vrmGrabStateRef.current.grabbedBoneOriginalRot;
        const duration = 500; // 500ms
        const startTime = Date.now();

        const animateBack = () => {
          if (!boneToAnimate) return; // 念のためnullチェック

          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // イージング関数（ease-out）
          const eased = 1 - Math.pow(1 - progress, 3);

          // 位置を補間
          boneToAnimate.position.lerpVectors(startPos, targetPos, eased);
          boneToAnimate.quaternion.slerpQuaternions(startRot, targetRot, eased);

          if (progress < 1) {
            requestAnimationFrame(animateBack);
          } else {
            console.log('[VRM Grab] Animation complete');
          }
        };

        animateBack();

        // グラブ状態をリセット
        isGrabbing = false;
        grabbedBone = null;
        grabbedBoneOriginalPos = null;
        grabbedBoneOriginalRot = null;
        grabStarted = false;
        isDragging = false;
        dragStartPos = null;

        // Refもリセット
        vrmGrabStateRef.current.isGrabbing = false;
        vrmGrabStateRef.current.grabbedBone = null;
        vrmGrabStateRef.current.targetWorldPos = null;
        vrmGrabStateRef.current.grabHitDistance = null;
        vrmGrabStateRef.current.grabbedBoneOriginalPos = null;
        vrmGrabStateRef.current.grabbedBoneOriginalRot = null;

        return;
      }

      if (!isDragging) return;

      const now = Date.now();
      const canReact = (now - lastTapReaction.current) > 10000;

      const dragDistance = dragStartPos ?
        Math.sqrt(
          Math.pow(event.clientX - dragStartPos.x, 2) +
          Math.pow(event.clientY - dragStartPos.y, 2)
        ) : 0;

      const dragDuration = now - dragStartTime;

      // ドラッグ距離が短く、時間も短ければタップ
      // ドラッグ距離が長いか、時間が長ければ撫でる
      if (dragDistance < 10 && dragDuration < 200) {
        // クールダウン中は無視
        if (!canReact) {
          isDragging = false;
          dragStartPos = null;
          console.log('[VRM Interaction] Tap ignored - cooldown active');
          return;
        }

        // インタラクション無効時は何もしない
        if (!enableInteraction) {
          console.log('[Interaction] Tap ignored - interaction disabled');
          return;
        }

        // クールダウン更新
        lastTapReaction.current = now;

        let tappedBoneName = null;
        let bodyPart = 'default';
        let selectedReaction = null;

        // 部位検出を行う
        if (enableInteraction) {
          // Raycasterでタップ位置のボーンを検出
          const canvas = gl.domElement;
          const rect = canvas.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
          );

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObject(vrmRef.current.scene, true);

          if (intersects.length > 0) {
            // タップ位置に最も近いボーンを探す
            const hitPoint = intersects[0].point;
            const vrm = vrmRef.current;
            const humanoid = vrm?.humanoid;

            if (humanoid) {
              let minDistance = Infinity;
              const boneNames = ['head', 'neck', 'chest', 'upperChest', 'spine', 'hips',
                                 'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
                                 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
                                 'leftFoot', 'rightFoot'];

              boneNames.forEach(boneName => {
                const bone = humanoid.getRawBoneNode(boneName);
                if (bone) {
                  const boneWorldPos = new THREE.Vector3();
                  bone.getWorldPosition(boneWorldPos);
                  const distance = hitPoint.distanceTo(boneWorldPos);
                  if (distance < minDistance) {
                    minDistance = distance;
                    tappedBoneName = boneName;
                  }
                }
              });

              bodyPart = getBoneCategory(tappedBoneName);

              // タップアニメーション：Spring Boneに物理的な外力を加える
              if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                const maxDistance = 0.2; // 影響範囲：20cm（広げる）

                // 揺らしてはいけないボーンを除外するフィルター（ブラックリスト方式）
                const isUngrabableBone = (bone) => {
                  const name = bone.name || '';
                  const lower = name.toLowerCase();

                  // 顔のパーツ（目、眉、口など）
                  if (lower.includes('目') || lower.includes('eye') ||
                      lower.includes('眉') || lower.includes('brow') ||
                      lower.includes('口') || lower.includes('mouth') ||
                      lower.includes('lip') || lower.includes('唇') ||
                      lower.includes('まぶた') || lower.includes('eyelid')) {
                    return true;
                  }

                  // 頭、首
                  if (lower.includes('head') || lower.includes('頭') ||
                      lower.includes('neck') || lower.includes('首')) {
                    return true;
                  }

                  // 体幹（上半身、下半身、胸、腰、背骨）
                  if (lower.includes('spine') || lower.includes('背') ||
                      lower.includes('chest') || lower.includes('胸') ||
                      lower.includes('hips') || lower.includes('腰') ||
                      lower.includes('上半身') || lower.includes('下半身') ||
                      lower.includes('pelvis') || lower.includes('骨盤')) {
                    return true;
                  }

                  // 肩
                  if (lower.includes('shoulder') || lower.includes('肩')) {
                    return true;
                  }

                  return false;
                };

                // Spring Boneに物理的な外力を加える
                if (vrm.springBoneManager) {
                  const springBoneManager = vrm.springBoneManager;
                  const impulseStrength = 3.5; // 衝撃の強さ（0.5 → 2.0 → 3.5に増加）

                  if (springBoneManager.springs) {
                    let affectedJoints = 0;

                    springBoneManager.springs.forEach(spring => {
                      spring.joints.forEach(joint => {
                        // 揺らしてはいけないボーンは除外
                        if (isUngrabableBone(joint.bone)) {
                          return;
                        }

                        const jointWorldPos = new THREE.Vector3();
                        joint.bone.getWorldPosition(jointWorldPos);
                        const distance = hitPoint.distanceTo(jointWorldPos);

                        if (distance < maxDistance) {
                          const direction = new THREE.Vector3()
                            .subVectors(jointWorldPos, hitPoint)
                            .normalize();

                          const influence = 1.0 - (distance / maxDistance);
                          const impulse = direction.multiplyScalar(impulseStrength * influence);

                          if (joint._currentTail) {
                            joint._currentTail.add(impulse);
                            affectedJoints++;
                          }
                        }
                      });
                    });

                    console.log('[Tap Animation] Applied physics impulse to', affectedJoints, 'spring bone joints');
                  }
                }

                // マウスカーソル位置にタップエフェクトを追加
                if (onTapEffect) {
                  onTapEffect(event.clientX, event.clientY);
                }
              }
            }
          }

          console.log('[Interaction] Tapped on VRM model - bone:', tappedBoneName, 'bodyPart:', bodyPart);

          // GPT-5 nanoで部位カテゴリを判定（非同期）
          if (tappedBoneName && aiService.isReady) {
            (async () => {
              try {
                const categoryResult = await aiService.simpleQuery(
                  `ボーン名: "${tappedBoneName}"\n\nこのボーンは以下のどのカテゴリに属しますか？カテゴリ名のみ答えてください：\n- intimate（胸、腰、太もも、お尻など親密な部位）\n- head（頭、顔）\n- shoulder（肩）\n- arm（腕、手）\n- leg（脛、足）\n- default（その他）`,
                  'あなたは3Dモデルのボーン名から体の部位カテゴリを判定するAIです。カテゴリ名のみ答えてください。',
                  { model: 'gpt-5-nano', maxTokens: 20 }
                );
                const gptCategory = categoryResult.trim().toLowerCase();
                const validCategories = ['intimate', 'head', 'shoulder', 'arm', 'leg', 'default'];
                const finalCategory = validCategories.includes(gptCategory) ? gptCategory : bodyPart;

                console.log('[GPT-5 nano] Body part category:', { boneName: tappedBoneName, getBoneCategory: bodyPart, gptCategory: finalCategory });

                // GPT-5 nanoの判定結果で反応を変更（遅延反応として表示）
                if (finalCategory !== bodyPart && vrmRef.current?.expressionManager) {
                  const reactions = BODY_PART_REACTIONS[finalCategory] || BODY_PART_REACTIONS.default;
                  const gptReaction = reactions[Math.floor(Math.random() * reactions.length)];

                  const expressionManager = vrmRef.current.expressionManager;
                  // 全表情をリセット
                  ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'neutral', 'aa', 'ih', 'ou', 'ee', 'oh', 'blink'].forEach(exp => {
                    try { expressionManager.setValue(exp, 0); } catch(_) {}
                  });
                  // GPT判定による表情を適用
                  Object.entries(gptReaction.params).forEach(([param, value]) => {
                    try { expressionManager.setValue(param, value); } catch(err) {
                      console.log('[Interaction] Expression not available:', param);
                    }
                  });
                  console.log('[GPT-5 nano] Applied refined reaction:', gptReaction.name);
                }
              } catch (error) {
                console.error('[GPT-5 nano] Failed to identify body part category:', error);
              }
            })();
          }

          // 部位に応じた表情をランダムに適用（即座の反応）
          const reactions = BODY_PART_REACTIONS[bodyPart] || BODY_PART_REACTIONS.default;
          selectedReaction = reactions[Math.floor(Math.random() * reactions.length)];

          if (vrmRef.current?.expressionManager && selectedReaction) {
            const expressionManager = vrmRef.current.expressionManager;

            // 全表情をリセット
            ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'neutral', 'aa', 'ih', 'ou', 'ee', 'oh', 'blink'].forEach(exp => {
              try { expressionManager.setValue(exp, 0); } catch(_) {}
            });

            // 選択された表情パラメータを適用
            Object.entries(selectedReaction.params).forEach(([param, value]) => {
              try {
                expressionManager.setValue(param, value);
                console.log(`[Expression] Applied ${param}: ${value}`);
              } catch(_) {}
            });
          }
        }

        // インタラクションコールバックを呼ぶ（部位情報を含む）
        if (onInteraction && selectedReaction) {
          onInteraction({ type: 'tap', bodyPart, boneName: tappedBoneName, reaction: selectedReaction.name });
        }
      } else if (dragDistance > 30 || dragDuration > 300) {
        console.log('[Interaction] Petted VRM model');
        if (onInteraction) {
          onInteraction({ type: 'pet' });
        }
      }

      isDragging = false;
      dragStartPos = null;
    };

    const canvas = gl.domElement;

    // マウス追従用イベント
    if (enableMouseFollow) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // グラブ機能のためにcanvasにもmousemoveを登録（enableInteractionに関係なく）
    canvas.addEventListener('mousemove', handleMouseMove);

    // タップ検知用イベント（enableInteractionに関わらず常に設定、判定はhandleMouseUp内で）
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (enableMouseFollow) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enableMouseFollow, enableInteraction, camera, gl, onInteraction]);

  useEffect(() => {
    if (!enableMouseFollow) {
      targetRotation.current.x = 0;
      targetRotation.current.y = 0;
    }
  }, [enableMouseFollow]);

  // VRMスケールが変更された時に適用
  useEffect(() => {
    if (vrmRef.current && vrmRef.current.scene) {
      vrmRef.current.scene.scale.setScalar(vrmScale);
      console.log('[VRM] Scale updated:', vrmScale);
    }
  }, [vrmScale]);

  // 喋っている時は正面（カメラ）を向く - モーション再生中もマウス追従を有効にするためコメントアウト
  // useEffect(() => {
  //   if (isSpeaking) {
  //     targetRotation.current.x = 0;
  //     targetRotation.current.y = 0;
  //   }
  // }, [isSpeaking]);

  // 感情が変わったときの処理
  useEffect(() => {
    if (emotion !== currentEmotion.current) {
      console.log('Emotion changed:', currentEmotion.current, '->', emotion);
      currentEmotion.current = emotion;
      targetEmotionValue.current = 1; // 新しい感情表現を開始
      hasTriggeredGesture.current = false; // 新しい感情でジェスチャーをトリガー可能に

      // アクティビティタイムを更新
      lastActivityTime.current = Date.now();

      // 感情に応じたジェスチャーをトリガー
      if (gestureManagerRef.current && !gestureManagerRef.current.isPlayingGesture()) {
        switch (emotion) {
          case 'happy':
            gestureManagerRef.current.joy();
            break;
          case 'sad':
            gestureManagerRef.current.sad();
            break;
          case 'surprised':
            gestureManagerRef.current.surprised();
            break;
          case 'thinking':
            gestureManagerRef.current.thinking();
            break;
          case 'neutral':
            // ニュートラルの時は挨拶的な動きとして軽くうなずく
            gestureManagerRef.current.nod();
            break;
        }
      }
    }
  }, [emotion]);

  // 特定のジェスチャーをトリガー
  useEffect(() => {
    if (gesture && gestureManagerRef.current) {
      console.log('Triggering gesture:', gesture);

      // アクティビティタイムを更新
      lastActivityTime.current = Date.now();

      switch (gesture) {
        case 'wave':
          gestureManagerRef.current.wave();
          break;
        case 'nod':
          gestureManagerRef.current.nod();
          break;
        case 'thinking':
          gestureManagerRef.current.thinking();
          break;
        case 'joy':
          gestureManagerRef.current.joy();
          break;
        case 'sad':
          gestureManagerRef.current.sad();
          break;
        case 'surprised':
          gestureManagerRef.current.surprised();
          break;
        case 'speaking':
          // 喋っている時は特別な処理（口パクはuseFrameで処理）
          break;
      }
    }
  }, [gesture]);

  useFrame((state, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) {
      return;
    }

    const time = clockRef.current.getElapsedTime();

    // 照れた状態のタイマー（3秒で元に戻る）
    if (isShy.current) {
      shyTimer.current += delta;
      if (shyTimer.current > 3.0) {
        isShy.current = false;
        shyTimer.current = 0;
        console.log('[Interaction] Shy state ended');
      }
    }
    const vrmaManager = vrmaAnimationManagerRef.current;
    if (vrmaManager) {
      vrmaManager.update(delta);
    }

    const isVRMAPlaying = vrmaManager?.isPlaying();
    const isLoopingVRMA = Boolean(vrmaManager?.currentAction && vrmaManager.currentAction.loop === THREE.LoopRepeat);
    const allowOverlay = false; // 呼吸とマウス追従を無効化

    // VRMAアニメーションのループ検知
    if (isVRMAPlaying && vrmaManager?.currentAction) {
      const currentTime = vrmaManager.currentAction.time;
      if (lastAnimationTime.current > 0 && currentTime < lastAnimationTime.current) {
        console.log('[VRM] Animation looped, resetting emotion');
        targetEmotionValue.current = 1; // 表情をリセット
      }
      lastAnimationTime.current = currentTime;

      // 腕以外のボーンのVRMAモーションを弱める（overlayBlendRatioが高いほど弱める）
      // headとneckはマウス追従で制御するため除外
      // 一時的に無効化
      if (false && overlayBlendRatio > 0 && humanoid) {
        const blendFactor = 1.0 - (overlayBlendRatio * 0.5); // 最大50%まで弱める

        // 腕、頭、首のボーンは除外
        const excludeBones = ['rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'head', 'neck'];

        // 体幹と脚のボーンのみ処理
        ['hips', 'spine', 'chest', 'upperChest',
         'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
         'leftUpperLeg', 'leftLowerLeg', 'leftFoot'].forEach(boneName => {
          if (!excludeBones.includes(boneName)) {
            const bone = humanoid.getRawBoneNode(boneName);
            if (bone && bone.quaternion) {
              // 元の回転とアイデンティティ（回転なし）をブレンド
              bone.quaternion.slerp(new THREE.Quaternion(), 1.0 - blendFactor);
            }
          }
        });
      }
    } else {
      lastAnimationTime.current = -1;
    }

    const humanoid = vrm.humanoid;
    const chest = humanoid?.getRawBoneNode('chest');
    const upperChest = humanoid?.getRawBoneNode('upperChest');
    const head = humanoid?.getRawBoneNode('head');
    const neck = humanoid?.getRawBoneNode('neck');

    // VRMAアニメーション更新後のボーン状態を保存（オフセット適用のベースとして使用）
    const baseChestQuat = chest?.quaternion.clone();
    const baseUpperChestQuat = upperChest?.quaternion.clone();
    const baseHeadQuat = head?.quaternion.clone();
    const baseNeckQuat = neck?.quaternion.clone();

    const lerpSpeed = Math.min(1, delta * 5);

    // マウス追従の計算（角度制限付き）
    if (enableMouseFollow) {
      const targetRotX = targetRotation.current.x;
      const targetRotY = targetRotation.current.y;
      currentRotation.current.x += (targetRotX - currentRotation.current.x) * lerpSpeed;
      currentRotation.current.y += (targetRotY - currentRotation.current.y) * lerpSpeed;

      // デバッグ：targetRotationも表示
      if (Math.random() < 0.01) {
        console.log('[MouseFollow] target x:', targetRotation.current.x.toFixed(3), 'y:', targetRotation.current.y.toFixed(3),
                    'current x:', currentRotation.current.x.toFixed(3), 'y:', currentRotation.current.y.toFixed(3));
      }
    }

    if (allowOverlay) {
      const breathSpeed = 2;
      const breathIntensity = 0.02; // overlayBlendRatioに関係なく常に100%適用

      // 呼吸アニメーション（保存したベース状態にオフセットを適用）
      const chestOffset = Math.sin(time * breathSpeed) * breathIntensity;
      if (chest && baseChestQuat) {
        const offsetQuat = new THREE.Quaternion();
        const euler = new THREE.Euler(chestOffset, 0, 0, 'XYZ');
        offsetQuat.setFromEuler(euler);
        chest.quaternion.copy(baseChestQuat).multiply(offsetQuat);
      }

      const upperChestOffset = Math.sin(time * breathSpeed + 0.5) * breathIntensity * 0.7;
      if (upperChest && baseUpperChestQuat) {
        const offsetQuat = new THREE.Quaternion();
        const euler = new THREE.Euler(upperChestOffset, 0, 0, 'XYZ');
        offsetQuat.setFromEuler(euler);
        upperChest.quaternion.copy(baseUpperChestQuat).multiply(offsetQuat);
      }

      // マウス追従（保存したベース状態にオフセットを適用、角度制限付き）
      if (enableMouseFollow) {
        const swaySpeed = 0.5;
        const swayIntensity = 0.02;

        // 角度制限（-60度〜60度、ラジアンで約-1.05〜1.05）
        const maxRotation = 1.05;
        const clampedX = Math.max(-maxRotation, Math.min(maxRotation, currentRotation.current.x));
        const clampedY = Math.max(-maxRotation, Math.min(maxRotation, currentRotation.current.y));

        // overlayBlendRatioに関係なく常に100%適用
        const headRotX = clampedX * 0.7;
        const headRotY = clampedY * 0.7 + Math.sin(time * swaySpeed) * swayIntensity;
        const headRotZ = Math.cos(time * swaySpeed * 0.7) * swayIntensity * 0.5;
        if (head && baseHeadQuat) {
          const offsetQuat = new THREE.Quaternion();
          const euler = new THREE.Euler(headRotX, headRotY, headRotZ, 'XYZ');
          offsetQuat.setFromEuler(euler);
          head.quaternion.copy(baseHeadQuat).multiply(offsetQuat);

          // デバッグ：1%の確率でログ出力
          if (Math.random() < 0.01) {
            console.log('[HeadRotation] head exists:', !!head, 'baseHeadQuat exists:', !!baseHeadQuat,
                        'rotX:', headRotX.toFixed(3), 'rotY:', headRotY.toFixed(3),
                        'overlayBlendRatio:', overlayBlendRatio);
          }
        } else {
          // デバッグ：ボーンが取得できない場合
          if (Math.random() < 0.01) {
            console.log('[HeadRotation] Missing bone - head:', !!head, 'baseHeadQuat:', !!baseHeadQuat);
          }
        }

        const neckRotX = clampedX * 0.3;
        const neckRotY = clampedY * 0.3 + Math.sin(time * swaySpeed + 1) * swayIntensity * 0.5;
        const neckRotZ = Math.cos(time * swaySpeed * 0.7 + 1) * swayIntensity * 0.3;
        if (neck && baseNeckQuat) {
          const offsetQuat = new THREE.Quaternion();
          const euler = new THREE.Euler(neckRotX, neckRotY, neckRotZ, 'XYZ');
          offsetQuat.setFromEuler(euler);
          neck.quaternion.copy(baseNeckQuat).multiply(offsetQuat);
        }
      }
    }

    if (allowOverlay) {
      if (humanoid) {
        const rightUpperArm = humanoid.getRawBoneNode('rightUpperArm');
        const leftUpperArm = humanoid.getRawBoneNode('leftUpperArm');

        if (rightUpperArm && !gestureManagerRef.current?.isPlayingGesture() && !idleAnimationManagerRef.current?.isPlayingAnimation()) {
          rightUpperArm.rotation.x = 0.1 + Math.sin(time * 0.5) * 0.02;
          rightUpperArm.rotation.z = 0.3 + Math.sin(time * 0.3) * 0.03;
        }
        if (leftUpperArm && !gestureManagerRef.current?.isPlayingGesture() && !idleAnimationManagerRef.current?.isPlayingAnimation()) {
          leftUpperArm.rotation.x = 0.1 + Math.sin(time * 0.5 + 1) * 0.02;
          leftUpperArm.rotation.z = -0.3 + Math.sin(time * 0.3 + 1) * 0.03;
        }
      }

      if (isTyping && humanoid) {
        const typingSpeed = 10;
        const typingIntensity = 0.05;

        const rightHand = humanoid.getRawBoneNode('rightHand');
        if (rightHand) {
          rightHand.rotation.z = Math.sin(time * typingSpeed) * typingIntensity;
          rightHand.rotation.x = Math.sin(time * typingSpeed * 1.3) * typingIntensity * 0.5;
        }

        const leftHand = humanoid.getRawBoneNode('leftHand');
        if (leftHand) {
          leftHand.rotation.z = -Math.sin(time * typingSpeed * 1.1) * typingIntensity;
          leftHand.rotation.x = Math.sin(time * typingSpeed * 1.5) * typingIntensity * 0.5;
        }

        const rightShoulder = humanoid.getRawBoneNode('rightShoulder');
        if (rightShoulder) {
          rightShoulder.rotation.z = Math.sin(time * typingSpeed * 0.5) * typingIntensity * 0.3;
        }

        const leftShoulder = humanoid.getRawBoneNode('leftShoulder');
        if (leftShoulder) {
          leftShoulder.rotation.z = -Math.sin(time * typingSpeed * 0.5) * typingIntensity * 0.3;
        }
      }
    }

    blinkTimer.current += delta;

    if (blinkTimer.current >= nextBlinkTime.current && !isBlinking.current) {
      isBlinking.current = true;
      blinkTimer.current = 0;

      const expressionManager = vrm.expressionManager;
      if (expressionManager) {
        if (expressionManager.setValue) {
          expressionManager.setValue('blink', 1);
        }

        setTimeout(() => {
          if (vrmRef.current?.expressionManager?.setValue) {
            vrmRef.current.expressionManager.setValue('blink', 0);
          }
          isBlinking.current = false;
          nextBlinkTime.current = Math.random() * 3 + 2;
        }, 100);
      }
    }

    const expressionManager = vrm.expressionManager;
    if (expressionManager && expressionManager.setValue) {
      // 表情を常に減衰させる（ループ時にリセットされる）
      if (targetEmotionValue.current > 0) {
        targetEmotionValue.current -= delta * 0.15; // とてもゆっくり減衰
        if (targetEmotionValue.current < 0) targetEmotionValue.current = 0;
      }

      // 表情をより大袈裟に（intensityを1.3倍に増幅、最大1.0）
      const amplifiedIntensity = Math.min(emotionIntensity * 1.3, 1.0);
      const emotionValue = targetEmotionValue.current * amplifiedIntensity;

      // isSpeaking時でもベース表情は適用（GPT-5 nanoはその上に追加）
      if (true) {
        // まず全表情を0にクリア（プリセット + 個別パラメータ）
        ['happy', 'sad', 'angry', 'surprised', 'relaxed', 'neutral'].forEach(exp => {
          try { expressionManager.setValue(exp, 0); } catch(_) {}
        });

        // パラメータ組み合わせで表情を作成（基本BlendShapeを使用）
        const applyEmotion = (emotion, value) => {
          if (value <= 0) return;

          switch(emotion) {
            case 'happy':
              // 笑顔：プリセットがあれば使用、なければ「い」の口で笑顔
              try {
                expressionManager.setValue('happy', value);
              } catch(_) {
                try { expressionManager.setValue('ih', value * 0.6); } catch(_) {}
              }
              break;

            case 'sad':
              // 悲しい：プリセットがあれば使用、なければ「う」の口
              try {
                expressionManager.setValue('sad', value);
              } catch(_) {
                try { expressionManager.setValue('ou', value * 0.4); } catch(_) {}
              }
              break;

            case 'angry':
              // 怒り：プリセットがあれば使用
              try { expressionManager.setValue('angry', value); } catch(_) {}
              break;

            case 'surprised':
              // 驚き：プリセット + 「あ」の口で大きく開ける
              try { expressionManager.setValue('surprised', value); } catch(_) {}
              try { expressionManager.setValue('aa', value * 0.8); } catch(_) {}
              break;

            case 'thinking':
              // 考え中：リラックス表情
              try { expressionManager.setValue('relaxed', value); } catch(_) {}
              break;

            case 'sleeping':
              // 寝ている：目を閉じて、口を閉じた笑顔（「い」の形）
              try { expressionManager.setValue('blink', 1.0); } catch(_) {}
              try { expressionManager.setValue('ih', 0.3 * value); } catch(_) {}
              break;

            case 'neutral':
            default:
              // ニュートラル：全てリセット済み
              break;
          }
        };

        applyEmotion(currentEmotion.current, emotionValue);
      }

      // GPT-5 nano表情制御（テキスト生成完了時点で即座に開始）
      // ★コメントアウト：表情操作が不自然なため無効化
      /*
      if (currentSpeechText && currentSpeechText !== lastSpeechText.current && expressionManager) {
        lastSpeechText.current = currentSpeechText;

        // 利用可能な表情モーフのリストを取得
        const availableExpressions = [];
        if (expressionManager.expressionMap) {
          availableExpressions.push(...Object.keys(expressionManager.expressionMap));
        } else if (expressionManager.expressions) {
          expressionManager.expressions.forEach(exp => {
            if (exp.expressionName) availableExpressions.push(exp.expressionName);
          });
        }

        console.log('[GPT-5 nano] Requesting expression params (before speaking starts)');

        // GPT-5 nanoで表情パラメータを生成（発話開始前に）
        if (availableExpressions.length > 0 && aiService.isReady) {
          (async () => {
            try {
              const params = await aiService.generateExpressionParams(currentSpeechText, availableExpressions);
              if (params && lastSpeechText.current === currentSpeechText) {
                gptExpressionParams.current = params;
                console.log('[GPT-5 nano] Expression params ready:', params);
              }
            } catch (error) {
              console.error('[GPT-5 nano] Failed to generate expression params:', error);
            }
          })();
        }
      } else if (!isSpeaking && !currentSpeechText) {
        // 発話完全終了時にクリア
        lastSpeechText.current = '';
        gptExpressionParams.current = null;
      }
      */

      // 口パク（喋っている時）
      if (isSpeaking && expressionManager.setValue) {
        mouthTimer.current += delta;
        const mouthSpeed = 8; // 口の開閉速度

        // 0.15秒ごとに口の状態を切り替え
        if (mouthTimer.current >= 0.15) {
          mouthState.current = mouthState.current === 0 ? 1 : 0;
          mouthTimer.current = 0;
        }

        // 滑らかな開閉のための補間
        const mouthProgress = mouthTimer.current / 0.15;
        let mouthValue;
        if (mouthState.current === 1) {
          mouthValue = Math.min(1, mouthProgress); // 開く
        } else {
          mouthValue = Math.max(0, 1 - mouthProgress); // 閉じる
        }

        // 'aa' と 'oh' を交互に使って自然な口の動き
        const useAa = Math.floor(time * mouthSpeed) % 2 === 0;
        try {
          if (useAa) {
            expressionManager.setValue('aa', mouthValue * 0.6);
            expressionManager.setValue('oh', 0);
          } else {
            expressionManager.setValue('aa', 0);
            expressionManager.setValue('oh', mouthValue * 0.5);
          }
        } catch (_) {
          // ignore
        }

        // GPT-5 nanoが生成した表情パラメータを適用
        if (gptExpressionParams.current) {
          try {
            Object.entries(gptExpressionParams.current).forEach(([expName, value]) => {
              // aa と oh は口パクで制御しているので、それ以外の表情のみ適用
              if (expName !== 'aa' && expName !== 'oh' && typeof value === 'number') {
                expressionManager.setValue(expName, value);
              }
            });
          } catch (error) {
            console.error('[GPT-5 nano] Failed to apply expression params:', error);
          }
        }
      } else if (!isSpeaking && expressionManager.setValue) {
        // 喋っていない時は口パクをリセット
        try {
          // 全ての母音を無条件でリセット（確実にクリアするため）
          expressionManager.setValue('aa', 0);
          expressionManager.setValue('ih', 0);
          expressionManager.setValue('ou', 0);
          expressionManager.setValue('ee', 0);
          expressionManager.setValue('oh', 0);
          mouthTimer.current = 0;
          mouthState.current = 0;

          // GPT-5 nanoが設定した表情もリセット
          // ★コメントアウト：表情操作が不自然なため無効化
          /*
          if (gptExpressionParams.current) {
            Object.keys(gptExpressionParams.current).forEach(expName => {
              if (expName !== 'aa' && expName !== 'oh') {
                try {
                  expressionManager.setValue(expName, 0);
                } catch (_) {}
              }
            });
          }
          */
        } catch (_) {
          // ignore
        }
      }
    }

    try {
      if (typeof vrm.update === 'function') {
        vrm.update(delta);
      } else {
        if (vrm.expressionManager?.update) {
          vrm.expressionManager.update(delta);
        }
        if (vrm.springBoneManager?.update) {
          vrm.springBoneManager.update(delta);
        }
      }
    } catch (error) {
      console.error('VRM update error:', error);
    }

    if (gestureManagerRef.current) {
      gestureManagerRef.current.update(delta);
    }

    const timeSinceLastActivity = Date.now() - lastActivityTime.current;
    const isUserActive = isTyping ||
                        gestureManagerRef.current?.isPlayingGesture() ||
                        timeSinceLastActivity < 3000; // 3秒以内はアクティブとみなす

    if (idleAnimationManagerRef.current) {
      if (isVRMAPlaying) {
        if (idleAnimationManagerRef.current.isPlayingAnimation()) {
          idleAnimationManagerRef.current.stop(0.2);
        }
      } else {
        idleAnimationManagerRef.current.update(delta, isUserActive);
      }
    }

    // カメラ追従機能
    if (enableCameraFollow && onCameraChange && vrm && cameraConfig) {
      // VRMモデルのバウンディングボックスを計算
      const bbox = new THREE.Box3().setFromObject(vrm.scene);
      const center = new THREE.Vector3();
      bbox.getCenter(center);

      // バウンディングボックスのサイズを取得（スケールの影響を除外）
      const size = new THREE.Vector3();
      bbox.getSize(size);
      // スケールで割ってベースサイズに戻す
      size.divideScalar(vrmScale);

      // モデルの高さで姿勢判定（寝ている/立っている）
      const isLyingDown = size.y < 0.5; // 高さが0.5未満なら寝ている

      const currentLookAt = cameraConfig.lookAt || [0, 1, 0];
      const targetLookAt = [
        center.x,
        center.y, // 中心を見る
        center.z
      ];

      // スムーズに追従（lerp）
      const followSpeed = 0.1; // 追従速度を2倍に
      const newLookAt = [
        currentLookAt[0] + (targetLookAt[0] - currentLookAt[0]) * followSpeed,
        currentLookAt[1] + (targetLookAt[1] - currentLookAt[1]) * followSpeed,
        currentLookAt[2] + (targetLookAt[2] - currentLookAt[2]) * followSpeed
      ];

      // カメラ距離を姿勢に応じて調整（スケール非依存の固定距離）
      const currentPos = cameraConfig.position || [0, 1.4, 2.5];

      // 寝ている時は近づく、立っている時は通常距離（ベースサイズを使用）
      const targetDistance = isLyingDown
        ? Math.max(1.5, size.length() * 1.0)  // 寝ている時は近く
        : Math.max(2.5, size.length() * 1.5); // 立っている時は通常

      // カメラ位置を計算（相対方向を維持）
      const offsetX = currentPos[0] - currentLookAt[0];
      const offsetZ = currentPos[2] - currentLookAt[2];
      const currentAngle = Math.atan2(offsetX, offsetZ);

      // Y位置も姿勢に応じて調整
      const targetY = isLyingDown
        ? newLookAt[1] + 1.5  // 寝ている時は真上から
        : newLookAt[1] + 0.6; // 立っている時は少し上から

      const newPosition = [
        newLookAt[0] + Math.sin(currentAngle) * targetDistance,
        targetY,
        newLookAt[2] + Math.cos(currentAngle) * targetDistance
      ];

      onCameraChange({
        position: newPosition,
        lookAt: newLookAt,
        fov: cameraConfig.fov || 50
      });
    }

    // グラブ中のボーン位置更新（Spring Bone更新の後に適用）
    if (vrmGrabStateRef.current.isGrabbing && vrmGrabStateRef.current.grabbedBone && vrmGrabStateRef.current.targetWorldPos) {
      const bone = vrmGrabStateRef.current.grabbedBone;
      const targetWorldPos = vrmGrabStateRef.current.targetWorldPos;

      // ターゲット位置をボーンの親のローカル座標に変換
      if (bone.parent) {
        const parentWorldMatrixInv = new THREE.Matrix4().copy(bone.parent.matrixWorld).invert();
        const localTargetPos = targetWorldPos.clone().applyMatrix4(parentWorldMatrixInv);
        bone.position.copy(localTargetPos);
      }
    }
  });

  return null;
}

// MMDモデルコンポーネント
function MMDModel({ url, onLoad, vmdUrls = [], fileMap, onAnimationDuration, onMeshReady, onInteraction, tapMotionUrls = [], petMotionUrls = [], onMmdInteractionMotion, helperRef: parentHelperRef, sceneRef: parentSceneRef, clonedMeshRef: parentClonedMeshRef, enableCameraFollow = false, onCameraChange, cameraConfig, targetLoopCount = 3, onLoopComplete, enablePhysicsRef, enablePhysics, enablePmxAnimation, enableSimplePhysics = false, onTapEffect, isSpeaking = false, currentSpeechText = '', mmdScale = 0.09, mmdShininess = 50, mmdBrightness = 1.0 }) {
  // fileMap: Map<filename, objectURL>

  const { scene, camera, gl } = useThree();

  // sceneをparentに伝える
  useEffect(() => {
    if (parentSceneRef) {
      parentSceneRef.current = scene;
    }
  }, [scene, parentSceneRef]);

  const meshRef = useRef();
  const helperRef = useRef();
  const onTapEffectRef = useRef(onTapEffect);
  const loaderRef = useRef();
  const initialBonesStateRef = useRef(null);
  const loopCounterRef = useRef({ currentLoops: 0, lastTime: -1, targetLoops: targetLoopCount });
  const reinitializeAnimationRef = useRef(null);
  const physicsFrameCounter = useRef(0);
  const accumulatedDelta = useRef(0);
  const mmdLipSyncRef = useRef({ targets: [] });
  const mmdMouthTimerRef = useRef(0);
  const mmdMouthStateRef = useRef(0);

  // GPT-5 nano表情制御用（MMD）
  const mmdGptExpressionParamsRef = useRef(null);
  const mmdLastSpeechTextRef = useRef('');

  // 簡易物理演算用（回転ベース）
  const simplePhysicsBonesRef = useRef([]);  // { bone, prevRotation, angularVelocity, parentPrevRotation, mass, stiffness, dampingRatio, restRotation, restLength }
  const simplePhysicsInitializedRef = useRef(false);
  const simplePhysicsTracksRemovedRef = useRef(false);  // VMDトラック削除済みフラグ
  const simplePhysicsCollidersRef = useRef([]);  // 衝突判定用コライダー: { bone, radius, offset }

  // オブジェクトプーリング（OOM回避）
  const physicsResourcePool = useRef({
    vector3s: [],
    quaternions: [],
    getVector3() {
      return this.vector3s.pop() || new THREE.Vector3();
    },
    releaseVector3(v) {
      v.set(0, 0, 0);
      this.vector3s.push(v);
    },
    getQuaternion() {
      return this.quaternions.pop() || new THREE.Quaternion();
    },
    releaseQuaternion(q) {
      q.set(0, 0, 0, 1);
      this.quaternions.push(q);
    }
  });

  // マテリアル調整用（テカリと明るさ）
  const mmdShininessRef = useRef(mmdShininess);
  const mmdBrightnessRef = useRef(mmdBrightness);
  const materialUpdateNeededRef = useRef(false);

  // グラブ機能用
  const mmdGrabStateRef = useRef({
    isGrabbing: false,
    grabbedBone: null,
    targetWorldPos: null,
    grabHitDistance: null
  });

  // fileMapとonLoadの参照を保存
  const fileMapRef = useRef(fileMap);
  const onLoadRef = useRef(onLoad);
  const vmdUrlsRef = useRef(vmdUrls);
  const onAnimationDurationRef = useRef(onAnimationDuration);
  const onMeshReadyRef = useRef(onMeshReady);
  const onInteractionRef = useRef(onInteraction);
  const tapMotionUrlsRef = useRef(tapMotionUrls);
  const petMotionUrlsRef = useRef(petMotionUrls);
  const onMmdInteractionMotionRef = useRef(onMmdInteractionMotion);
  const onLoopCompleteRef = useRef(onLoopComplete);

  const resetMeshToInitialState = () => {
    const mesh = meshRef.current;
    const initialBones = initialBonesStateRef.current;

    if (!mesh) {
      console.warn('[MMDModel] No mesh available for reset');
      return;
    }

    if (mesh.skeleton && Array.isArray(mesh.skeleton.bones) && mesh.skeleton.bones.length) {
      if (initialBones && initialBones.length === mesh.skeleton.bones.length) {
        mesh.skeleton.bones.forEach((bone, index) => {
          const saved = initialBones[index];
          if (!saved) return;
          bone.position.copy(saved.position);
          bone.quaternion.copy(saved.quaternion);
          bone.scale.copy(saved.scale);
          bone.updateMatrix();
          bone.updateMatrixWorld(true);
        });
      } else {
        mesh.skeleton.pose();
      }
      mesh.skeleton.update();
    }

    if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length) {
      for (let i = 0; i < mesh.morphTargetInfluences.length; i += 1) {
        mesh.morphTargetInfluences[i] = 0;
      }
    }

    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);

    if (typeof mesh.traverse === 'function') {
      mesh.traverse((child) => {
        if (child && typeof child.updateMatrix === 'function') {
          child.updateMatrix();
        }
        if (child && typeof child.updateMatrixWorld === 'function') {
          child.updateMatrixWorld(true);
        }
      });
    }
  };

  const storeInitialPhysicsState = (meshObj) => {
    const mesh = meshRef.current;
    if (!mesh || !meshObj?.physics || !Array.isArray(meshObj.physics.bodies) || !window.Ammo) {
      return;
    }

    const initialStates = meshObj.physics.bodies.map((wrapper) => {
      const body = wrapper?.body || wrapper;
      if (!body || typeof body.getMotionState !== 'function') {
        return null;
      }

      const transform = new window.Ammo.btTransform();
      body.getMotionState().getWorldTransform(transform);
      const origin = transform.getOrigin();
      const rotation = transform.getRotation();

      const record = {
        position: [origin.x(), origin.y(), origin.z()],
        quaternion: [rotation.x(), rotation.y(), rotation.z(), rotation.w()]
      };

      window.Ammo.destroy(transform);
      return record;
    });

    mesh.userData = mesh.userData || {};
    mesh.userData.initialPhysicsState = initialStates;
    mesh.userData.restorePhysicsState = (target) => restorePhysicsState(target);
    mesh.userData.initializeMmdLipSyncTargets = () => initializeMmdLipSyncTargets(mesh);
  };

  const restorePhysicsState = (meshObj) => {
    const mesh = meshRef.current;
    const states = mesh?.userData?.initialPhysicsState;

    if (!meshObj?.physics || !Array.isArray(meshObj.physics.bodies) || !states || !window.Ammo) {
      return false;
    }

    meshObj.physics.bodies.forEach((wrapper, index) => {
      const state = states[index];
      if (!state) {
        return;
      }

      const body = wrapper?.body || wrapper;
      if (!body) {
        return;
      }

      const transform = new window.Ammo.btTransform();
      transform.setIdentity();

      const origin = new window.Ammo.btVector3(state.position[0], state.position[1], state.position[2]);
      transform.setOrigin(origin);

      const rotation = new window.Ammo.btQuaternion(state.quaternion[0], state.quaternion[1], state.quaternion[2], state.quaternion[3]);
      transform.setRotation(rotation);

      if (typeof body.setWorldTransform === 'function') {
        body.setWorldTransform(transform);
      }
      if (typeof body.getMotionState === 'function') {
        const motionState = body.getMotionState();
        if (motionState && typeof motionState.setWorldTransform === 'function') {
          motionState.setWorldTransform(transform);
        }
      }

      const zero = new window.Ammo.btVector3(0, 0, 0);
      if (typeof body.setLinearVelocity === 'function') {
        body.setLinearVelocity(zero);
      }
      if (typeof body.setAngularVelocity === 'function') {
        body.setAngularVelocity(zero);
      }
      if (typeof body.activate === 'function') {
        body.activate(true);
      }

      window.Ammo.destroy(zero);
      window.Ammo.destroy(rotation);
      window.Ammo.destroy(origin);
      window.Ammo.destroy(transform);
    });

    return true;
  };

  const initializeMmdLipSyncTargets = (root) => {
    if (!root) {
      mmdLipSyncRef.current = { targets: [] };
      return;
    }

    // MMDの標準的な母音モーフ名（全角・半角・英語バリエーション）
    const vowelCandidates = {
      a: ['あ', 'あ１', 'あ2', 'あ０', 'A', 'a', 'aa', 'mouth_a', 'mouthA'],
      i: ['い', 'い１', 'い2', 'い０', 'I', 'i', 'ii', 'mouth_i', 'mouthI'],
      u: ['う', 'う１', 'う2', 'う０', 'U', 'u', 'uu', 'mouth_u', 'mouthU'],
      e: ['え', 'え１', 'え2', 'え０', 'E', 'e', 'ee', 'mouth_e', 'mouthE'],
      o: ['お', 'お１', 'お2', 'お０', 'O', 'o', 'oo', 'mouth_o', 'mouthO', 'oh']
    };

    const targets = [];

    root.traverse?.((child) => {
      const dict = child?.morphTargetDictionary;
      const influences = child?.morphTargetInfluences;
      if (!dict || !influences) {
        return;
      }

      const findIndex = (names) => {
        for (const name of names) {
          if (dict[name] !== undefined) {
            return { index: dict[name], name };
          }
        }
        return null;
      };

      // 全ての母音を検索
      const vowels = {};
      for (const [vowel, candidates] of Object.entries(vowelCandidates)) {
        const info = findIndex(candidates);
        if (info) {
          vowels[vowel] = info;
        }
      }

      // 最低1つの母音が見つかったら追加
      if (Object.keys(vowels).length > 0) {
        targets.push({
          mesh: child,
          influences,
          vowels,
          vowelNames: Object.keys(vowels)
        });
      }
    });

    mmdLipSyncRef.current = { targets };
    if (targets.length) {
      const summary = targets.map((target, idx) => {
        const vowelList = target.vowelNames.map(v => `${v}=${target.vowels[v].name}`).join(', ');
        return `#${idx} [${vowelList}]`;
      }).join(' | ');
      console.log('[MMD LipSync] Vowel morphs detected:', summary);
    } else {
      console.log('[MMD LipSync] No vowel morph targets found');
    }
  };

  const applyAnimationClip = (animation) => {
    const mesh = meshRef.current;
    let helper = helperRef.current;

    if (!mesh || !helper || !animation) {
      console.warn('[MMDModel] Cannot apply animation - missing mesh/helper/clip');
      return null;
    }

    const run = (physicsOverride) => {
      const wantsPhysics = (typeof physicsOverride === 'boolean'
        ? physicsOverride
        : (enablePhysicsRef.current && !!window.Ammo));

      // ★ helper自体を破棄して再作成（OOM対策の切り札）
      console.log('[MMD Physics] Destroying and recreating helper to free memory');

      // 既存helperのクリーンアップ
      const existingObj = helper.objects?.get(mesh);
      if (existingObj) {
        try {
          // mixerをクリーンアップ
          if (existingObj.mixer) {
            existingObj.mixer.stopAllAction();
            existingObj.mixer.uncacheRoot(mesh);
          }
          // helperから削除
          helper.remove(mesh);
        } catch (removeError) {
          console.warn('[MMD Physics] Remove failed:', removeError);
        }
      }

      // 古いhelperを完全に破棄（参照を切る）
      helperRef.current = null;
      helper = null;

      // 新しいhelperを作成
      const newHelper = new MMDAnimationHelper(enablePmxAnimation ? { pmxAnimation: true } : {});
      helperRef.current = newHelper;
      helper = newHelper;
      console.log('[MMD Physics] Created new MMDAnimationHelper');

      // ボーンを初期状態にリセット（モーション切り替え時のずれを防ぐ）
      resetMeshToInitialState();

      let meshObj = null;

      try {
        helper.add(mesh, { animation, physics: wantsPhysics });
        meshObj = helper.objects.get(mesh);
      } catch (error) {
        console.error('[MMD Physics] Failed to add mesh with physics:', error);
        if (error?.message && error.message.includes('OOM')) {
          console.error('[OOM Detected] Triggering model reload');
          // 物理をオフにせず、モデル全体を破棄・再ロードすることでメモリ解放
          if (window.oomCallback) {
            window.oomCallback();
          }
          return null;  // 処理を中断（再ロードが始まる）
        }
        // OOM以外のエラーの場合は物理オフで再試行
        try {
          helper.add(mesh, { animation, physics: false });
          meshObj = helper.objects.get(mesh);
        } catch (fallbackError) {
          console.error('[MMD Physics] Failed to add mesh without physics:', fallbackError);
        }
      }

      if (meshObj?.mixer) {
        const mixer = meshObj.mixer;
        mixer.stopAllAction();

        // Mixerの時間を完全にリセット
        mixer.setTime(0);

        const actions = mixer._actions ? [...mixer._actions] : [];
        actions.forEach((action) => {
          // アクションの時間を明示的に0にリセット
          action.time = 0;
          action.reset();
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
          action.enabled = true;
          action.paused = false;
        });

        // ★重要：IKソルバーはmixer設定後、play()前にリセット
        if (meshObj?.ikSolver && typeof meshObj.ikSolver.reset === 'function') {
          try {
            meshObj.ikSolver.reset();
            console.log('[MMD IK] Solver reset after mixer setup');

            // IKソルバーを初期フレーム（time=0）で更新
            if (typeof meshObj.ikSolver.update === 'function') {
              meshObj.ikSolver.update();
              console.log('[MMD IK] Solver updated to initial frame');
            }
          } catch (ikError) {
            console.warn('[MMD IK] Failed to reset/update solver:', ikError);
          }
        }

        // IKソルバーリセット後、アニメーション再生開始
        actions.forEach((action) => {
          action.play();
        });
        console.log(`[MMD] Started ${actions.length} animation actions${wantsPhysics ? '' : ' (without physics)'}`);
      }

      if (meshObj?.physics && meshObj.physics.world) {
        const world = meshObj.physics.world;
        const solverInfo = world.getSolverInfo();
        if (typeof solverInfo.set_m_numIterations === 'function') {
          solverInfo.set_m_numIterations(wantsPhysics ? 3 : 1);
        }
        if (typeof solverInfo.set_m_numSubSteps === 'function') {
          solverInfo.set_m_numSubSteps(wantsPhysics ? 1 : 0);
        }
        // ★重力を標準重力に（スカートが自然に揺れるように）
        const gravity = new window.Ammo.btVector3(0, wantsPhysics ? -9.8 : -9.8, 0);
        world.setGravity(gravity);
        window.Ammo.destroy(gravity);

        if (Array.isArray(meshObj.physics.bodies)) {
          const zero = new window.Ammo.btVector3(0, 0, 0);
          let resetCount = 0;

          meshObj.physics.bodies.forEach((bodyWrapper) => {
            const body = bodyWrapper?.body || bodyWrapper;
            if (!body) return;

            // ★ダンピング設定（低め = 柔らかく揺れる）
            if (typeof body.setDamping === 'function') {
              body.setDamping(wantsPhysics ? 0.3 : 0.95, wantsPhysics ? 0.4 : 0.95);
            }

            // ★速度リセット（重要）
            if (typeof body.setLinearVelocity === 'function') {
              body.setLinearVelocity(zero);
              body.setAngularVelocity(zero);
            }

            // ★位置・回転をボーンの現在位置に同期（クローン再構築後に重要）
            if (body.bone && typeof body.getMotionState === 'function') {
              const bonePos = new THREE.Vector3();
              const boneQuat = new THREE.Quaternion();
              body.bone.getWorldPosition(bonePos);
              body.bone.getWorldQuaternion(boneQuat);

              const transform = new window.Ammo.btTransform();
              transform.setIdentity();
              transform.setOrigin(new window.Ammo.btVector3(bonePos.x, bonePos.y, bonePos.z));
              transform.setRotation(new window.Ammo.btQuaternion(boneQuat.x, boneQuat.y, boneQuat.z, boneQuat.w));

              if (typeof body.setWorldTransform === 'function') {
                body.setWorldTransform(transform);
              }

              const motionState = body.getMotionState();
              if (motionState && typeof motionState.setWorldTransform === 'function') {
                motionState.setWorldTransform(transform);
              }

              window.Ammo.destroy(transform);
            }

            // ★アクティブ化
            if (typeof body.activate === 'function') {
              body.activate(true);
            }

            resetCount++;
          });

          window.Ammo.destroy(zero);
          console.log(`[MMD Physics] Reset ${resetCount} rigid bodies (velocity + transform)`);
        }
      }

      const counter = loopCounterRef.current;
      if (counter) {
        counter.currentLoops = 0;
        counter.lastTime = -1;
        counter.preLoopReset = false;
      }

      mesh.userData = mesh.userData || {};
      mesh.userData.loopCounterRef = loopCounterRef;
      mesh.userData.reinitializeMmdAnimation = run;
      mesh.userData.resetMmdPose = resetMeshToInitialState;
      mesh.userData.currentMmdClip = animation;
      storeInitialPhysicsState(meshObj);
      mesh.userData.initializeMmdLipSyncTargets = () => initializeMmdLipSyncTargets(mesh);
      initializeMmdLipSyncTargets(mesh);

      // if (mesh.skeleton && mesh.skeleton.bones) {
      //   const refreshedInitial = mesh.skeleton.bones.map((bone) => ({
      //     bone,
      //     position: bone.position.clone(),
      //     quaternion: bone.quaternion.clone(),
      //     scale: bone.scale.clone()
      //   }));
      //   initialBonesStateRef.current = refreshedInitial;
      // }

      reinitializeAnimationRef.current = run;

      return meshObj;
    };

    return run();
  };

  // インタラクション用ref
  const lastMousePos = useRef({ x: 0, y: 0, time: 0 });
  const petStrokes = useRef([]);
  const lastPetReaction = useRef(0);
  const lastTapReaction = useRef(0);

  useEffect(() => {
    fileMapRef.current = fileMap;
    onLoadRef.current = onLoad;
    vmdUrlsRef.current = vmdUrls;
    onAnimationDurationRef.current = onAnimationDuration;
    onMeshReadyRef.current = onMeshReady;
    onInteractionRef.current = onInteraction;
    tapMotionUrlsRef.current = tapMotionUrls;
    petMotionUrlsRef.current = petMotionUrls;
    onMmdInteractionMotionRef.current = onMmdInteractionMotion;
    onLoopCompleteRef.current = onLoopComplete;
    onTapEffectRef.current = onTapEffect;
  });

  // enablePhysicsをRefと同期
  useEffect(() => {
    enablePhysicsRef.current = enablePhysics;
  }, [enablePhysics]);

  // enablePhysicsの変更を監視して物理演算を再初期化
  const previousPhysicsRef = useRef(enablePhysics);
  useEffect(() => {
    if (previousPhysicsRef.current === enablePhysics) {
      return;
    }

    console.log('[MMD Physics] Physics setting changed:', previousPhysicsRef.current, '->', enablePhysics);
    previousPhysicsRef.current = enablePhysics;

    const mesh = meshRef.current;
    const reinitializer = mesh?.userData?.reinitializeMmdAnimation || reinitializeAnimationRef.current;

    if (typeof reinitializer === 'function') {
      try {
        reinitializer(enablePhysics);
        console.log('[MMD Physics] Reinitialized animation for physics toggle');
      } catch (error) {
        console.error('[MMD Physics] Failed to reinitialize after physics toggle:', error);
      }
    } else {
      console.warn('[MMD Physics] No reinitializer available when toggling physics');
    }
  }, [enablePhysics]);

  // targetLoopCountが変わったらリセット
  useEffect(() => {
    loopCounterRef.current.targetLoops = targetLoopCount;
    console.log('[MMDModel] Target loop count updated:', targetLoopCount);
  }, [targetLoopCount]);

  // モデルのロード（urlとsceneが変わったときのみ）
  useEffect(() => {
    console.log('[MMDModel] Model load effect triggered', { url });

    let cancelled = false;
    const loader = new MMDLoader();
    loaderRef.current = loader;

    // 新しいモデルをロードする時は古いボーン状態をクリア
    initialBonesStateRef.current = null;

    let resetURLModifier = null;

    const currentFileMap = fileMapRef.current;
    if (currentFileMap instanceof Map) {
      loader.setResourcePath('');
      const mapKeys = Array.from(currentFileMap.keys()).slice(0, 15);
      console.log('[MMD] FileMap size:', currentFileMap.size);
      console.log('[MMD] FileMap sample keys:');
      mapKeys.forEach((key, i) => console.log(`  [${i}]:`, key));
      const manager = loader.manager;
      const modifier = (rawUrl) => {
        if (!rawUrl) return rawUrl;

        // バックスラッシュをスラッシュに変換してからデコード
        const normalized = rawUrl.replace(/\\/g, '/');
        let decoded;
        try {
          decoded = decodeURIComponent(normalized);
        } catch (e) {
          decoded = normalized;
        }

        // blob:file:/// プレフィックスを削除
        let searchPath = decoded.replace(/^blob:file:\/\/\//, '');
        const lower = searchPath.toLowerCase();

        // fileMapから検索
        if (currentFileMap.has(lower)) {
          const found = currentFileMap.get(lower);
          console.log('[MMD URL Modifier] Full path match:', rawUrl, '->', found);
          return found;
        }

        const base = lower.split('/').pop();
        if (base && currentFileMap.has(base)) {
          const found = currentFileMap.get(base);
          console.log('[MMD URL Modifier] Base name match:', rawUrl, '->', found);
          return found;
        }

        // デバッグ: 利用可能なキーの一部を表示
        const availableKeys = Array.from(currentFileMap.keys()).slice(0, 10);
        console.warn('[MMD URL Modifier] No match found for:', rawUrl);
        console.warn('  - searchPath:', lower);
        console.warn('  - base:', base);
        console.warn('  - Available keys (first 10):', availableKeys);
        return rawUrl;
      };
      if (manager?.setURLModifier) {
        manager.setURLModifier(modifier);
        resetURLModifier = () => manager.setURLModifier(null);
      }
    }

    // Ammoが読み込まれるまで待機
    if (!AmmoInstance) {
      console.warn('[MMD Physics] Waiting for Ammo.js to load...');
      const checkAmmo = setInterval(() => {
        if (AmmoInstance) {
          clearInterval(checkAmmo);
          console.log('[MMD Physics] Ammo.js loaded, proceeding with model load');
        }
      }, 100);
    }

    const helper = new MMDAnimationHelper(enablePmxAnimation ? { pmxAnimation: true } : {});
    helperRef.current = helper;
    console.log('[MMD] Created MMDAnimationHelper with pmxAnimation:', enablePmxAnimation);
    if (parentHelperRef) {
      parentHelperRef.current = helper;
    }

    // OOM時の物理ワールド強制クリーンアップ関数を登録
    window.forceCleanupPhysics = () => {
      console.log('[Physics Cleanup] Starting forced cleanup');
      const mesh = meshRef.current;
      if (!mesh || !helper || !helper.objects) {
        console.log('[Physics Cleanup] No mesh/helper to clean');
        return;
      }

      const meshObj = helper.objects.get(mesh);
      if (!meshObj || !meshObj.physics) {
        console.log('[Physics Cleanup] No physics object to clean');
        return;
      }

      const physics = meshObj.physics;
      if (!physics.world || !window.Ammo) {
        console.log('[Physics Cleanup] No physics world or Ammo');
        return;
      }

      try {
        let cleanedBodies = 0;
        let cleanedConstraints = 0;

        // 全RigidBodyをワールドから削除
        if (Array.isArray(physics.bodies)) {
          physics.bodies.forEach(bodyWrapper => {
            const body = bodyWrapper?.body || bodyWrapper;
            if (body && typeof physics.world.removeRigidBody === 'function') {
              try {
                physics.world.removeRigidBody(body);
                cleanedBodies++;
              } catch (e) {
                console.warn('[Physics Cleanup] Failed to remove body:', e);
              }
            }
          });
          physics.bodies.length = 0; // 配列をクリア
        }

        // 全Constraintをワールドから削除
        if (Array.isArray(physics.constraints)) {
          physics.constraints.forEach(constraint => {
            if (constraint && typeof physics.world.removeConstraint === 'function') {
              try {
                physics.world.removeConstraint(constraint);
                cleanedConstraints++;
              } catch (e) {
                console.warn('[Physics Cleanup] Failed to remove constraint:', e);
              }
            }
          });
          physics.constraints.length = 0; // 配列をクリア
        }

        console.log(`[Physics Cleanup] Cleaned ${cleanedBodies} bodies, ${cleanedConstraints} constraints`);

        // 物理ワールド自体を削除（試験的）
        // Note: MMDPhysicsは内部でワールドを管理しているため、完全な破棄は難しい可能性あり
        if (typeof physics.world.destroy === 'function') {
          physics.world.destroy();
          console.log('[Physics Cleanup] Physics world destroyed');
        }

      } catch (error) {
        console.error('[Physics Cleanup] Error during cleanup:', error);
      }
    };

    loader.load(
      url,
      (mesh) => {
        if (cancelled) {
          if (typeof resetURLModifier === 'function') resetURLModifier();
          return;
        }

        console.log('[MMDModel] Model loaded successfully');

        // 物理演算情報をチェック
        if (mesh.geometry && mesh.geometry.userData) {
          const userData = mesh.geometry.userData;
          console.log('[MMD Physics] Rigid bodies:', userData.rigidBodies?.length || 0);
          console.log('[MMD Physics] Constraints:', userData.constraints?.length || 0);
        }

        // マテリアル調整（テカリと明るさ）- 元の色を保存
        const originalMaterials = [];
        let materialCount = 0;
        mesh.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat, idx) => {
                materialCount++;
                const origColor = (mat.color && typeof mat.color.clone === 'function') ? mat.color.clone() : null;

                // デバッグ: マテリアル情報を詳細にログ出力
                console.log(`[MMD Material ${materialCount}] name: ${mat.name || 'unnamed'}`);
                console.log(`  - color: r=${origColor?.r.toFixed(3)}, g=${origColor?.g.toFixed(3)}, b=${origColor?.b.toFixed(3)}`);
                console.log(`  - map: ${mat.map ? 'YES' : 'NO'}`, mat.map?.image?.src || mat.map?.image?.currentSrc || '');
                console.log(`  - emissive: r=${mat.emissive?.r.toFixed(3)}, g=${mat.emissive?.g.toFixed(3)}, b=${mat.emissive?.b.toFixed(3)}`);
                console.log(`  - emissiveMap: ${mat.emissiveMap ? 'YES' : 'NO'}`);
                console.log(`  - ambient: r=${mat.ambient?.r.toFixed(3)}, g=${mat.ambient?.g.toFixed(3)}, b=${mat.ambient?.b.toFixed(3)}`);
                console.log(`  - shininess: ${mat.shininess}`);
                console.log(`  - opacity: ${mat.opacity}`);
                console.log(`  - transparent: ${mat.transparent}`);

                originalMaterials.push({
                  material: mat,
                  originalColor: origColor,
                  originalShininess: mat.shininess
                });
                if (mat.shininess !== undefined) {
                  mat.shininess = mmdShininess;
                }
                if (mat.color && origColor && typeof mat.color.copy === 'function') {
                  mat.color.copy(origColor).multiplyScalar(mmdBrightness);
                }

                // テクスチャのエンコーディング設定を確認・修正
                if (mat.map) {
                  console.log(`  - map.encoding: ${mat.map.colorSpace || mat.map.encoding || 'not set'}`);
                  if (mat.map.colorSpace !== 'srgb' && !mat.map.encoding) {
                    mat.map.colorSpace = 'srgb';
                    mat.map.needsUpdate = true;
                    console.log(`  - Fixed map colorSpace to srgb`);
                  }
                }

                // ambient値の調整（上限・下限）
                if (mat.ambient) {
                  const avgAmbient = (mat.ambient.r + mat.ambient.g + mat.ambient.b) / 3;
                  if (avgAmbient > 0.7) {
                    // 高すぎる場合は減らす（色が薄くなる問題）
                    console.log(`  - WARNING: High ambient detected, reducing from (${mat.ambient.r.toFixed(3)}, ${mat.ambient.g.toFixed(3)}, ${mat.ambient.b.toFixed(3)})`);
                    mat.ambient.multiplyScalar(0.4);
                    console.log(`  - New ambient: (${mat.ambient.r.toFixed(3)}, ${mat.ambient.g.toFixed(3)}, ${mat.ambient.b.toFixed(3)})`);
                  } else if (avgAmbient < 0.15) {
                    // 低すぎる場合は上げる（暗すぎる問題）
                    console.log(`  - WARNING: Low ambient detected, increasing from (${mat.ambient.r.toFixed(3)}, ${mat.ambient.g.toFixed(3)}, ${mat.ambient.b.toFixed(3)})`);
                    mat.ambient.lerp(new THREE.Color(0.3, 0.3, 0.3), 0.5);
                    console.log(`  - New ambient: (${mat.ambient.r.toFixed(3)}, ${mat.ambient.g.toFixed(3)}, ${mat.ambient.b.toFixed(3)})`);
                  }
                }

                // emissive値の調整（上限のみ）
                if (mat.emissive && (mat.emissive.r > 0.1 || mat.emissive.g > 0.1 || mat.emissive.b > 0.1)) {
                  console.log(`  - WARNING: High emissive detected, setting to zero from (${mat.emissive.r.toFixed(3)}, ${mat.emissive.g.toFixed(3)}, ${mat.emissive.b.toFixed(3)})`);
                  mat.emissive.set(0, 0, 0);
                }
              });
            } else {
              materialCount++;
              const origColor = (child.material.color && typeof child.material.color.clone === 'function') ? child.material.color.clone() : null;

              // デバッグ: マテリアル情報を詳細にログ出力
              console.log(`[MMD Material ${materialCount}] name: ${child.material.name || 'unnamed'}`);
              console.log(`  - color: r=${origColor?.r.toFixed(3)}, g=${origColor?.g.toFixed(3)}, b=${origColor?.b.toFixed(3)}`);
              console.log(`  - map: ${child.material.map ? 'YES' : 'NO'}`, child.material.map?.image?.src || child.material.map?.image?.currentSrc || '');
              console.log(`  - emissive: r=${child.material.emissive?.r.toFixed(3)}, g=${child.material.emissive?.g.toFixed(3)}, b=${child.material.emissive?.b.toFixed(3)}`);
              console.log(`  - emissiveMap: ${child.material.emissiveMap ? 'YES' : 'NO'}`);
              console.log(`  - ambient: r=${child.material.ambient?.r.toFixed(3)}, g=${child.material.ambient?.g.toFixed(3)}, b=${child.material.ambient?.b.toFixed(3)}`);
              console.log(`  - shininess: ${child.material.shininess}`);
              console.log(`  - opacity: ${child.material.opacity}`);
              console.log(`  - transparent: ${child.material.transparent}`);

              originalMaterials.push({
                material: child.material,
                originalColor: origColor,
                originalShininess: child.material.shininess
              });
              if (child.material.shininess !== undefined) {
                child.material.shininess = mmdShininess;
              }
              if (child.material.color && origColor && typeof child.material.color.copy === 'function') {
                child.material.color.copy(origColor).multiplyScalar(mmdBrightness);
              }

              // テクスチャのエンコーディング設定を確認・修正
              if (child.material.map) {
                console.log(`  - map.encoding: ${child.material.map.colorSpace || child.material.map.encoding || 'not set'}`);
                if (child.material.map.colorSpace !== 'srgb' && !child.material.map.encoding) {
                  child.material.map.colorSpace = 'srgb';
                  child.material.map.needsUpdate = true;
                  console.log(`  - Fixed map colorSpace to srgb`);
                }
              }

              // ambient値の調整（上限・下限）
              if (child.material.ambient) {
                const avgAmbient = (child.material.ambient.r + child.material.ambient.g + child.material.ambient.b) / 3;
                if (avgAmbient > 0.7) {
                  // 高すぎる場合は減らす（色が薄くなる問題）
                  console.log(`  - WARNING: High ambient detected, reducing from (${child.material.ambient.r.toFixed(3)}, ${child.material.ambient.g.toFixed(3)}, ${child.material.ambient.b.toFixed(3)})`);
                  child.material.ambient.multiplyScalar(0.4);
                  console.log(`  - New ambient: (${child.material.ambient.r.toFixed(3)}, ${child.material.ambient.g.toFixed(3)}, ${child.material.ambient.b.toFixed(3)})`);
                } else if (avgAmbient < 0.15) {
                  // 低すぎる場合は上げる（暗すぎる問題）
                  console.log(`  - WARNING: Low ambient detected, increasing from (${child.material.ambient.r.toFixed(3)}, ${child.material.ambient.g.toFixed(3)}, ${child.material.ambient.b.toFixed(3)})`);
                  child.material.ambient.lerp(new THREE.Color(0.3, 0.3, 0.3), 0.5);
                  console.log(`  - New ambient: (${child.material.ambient.r.toFixed(3)}, ${child.material.ambient.g.toFixed(3)}, ${child.material.ambient.b.toFixed(3)})`);
                }
              }

              // emissive値の調整（上限のみ）
              if (child.material.emissive && (child.material.emissive.r > 0.1 || child.material.emissive.g > 0.1 || child.material.emissive.b > 0.1)) {
                console.log(`  - WARNING: High emissive detected, setting to zero from (${child.material.emissive.r.toFixed(3)}, ${child.material.emissive.g.toFixed(3)}, ${child.material.emissive.b.toFixed(3)})`);
                child.material.emissive.set(0, 0, 0);
              }
            }
          }
        });
        mesh.userData.originalMaterials = originalMaterials;
        materialUpdateNeededRef.current = true; // 初期適用をトリガー
        console.log(`[MMD Material] Total materials: ${materialCount}, Applied shininess: ${mmdShininess}, brightness: ${mmdBrightness}`);

        mesh.position.y = 0;
        mesh.scale.setScalar(mmdScale);
        scene.add(mesh);
        meshRef.current = mesh;

        // 簡易物理演算の初期化をリセット（新しいメッシュが読み込まれたため）
        simplePhysicsInitializedRef.current = false;
        simplePhysicsBonesRef.current = [];
        simplePhysicsCollidersRef.current = [];
        simplePhysicsTracksRemovedRef.current = false;
        console.log('[Simple Physics] Reset for new mesh');

        mesh.userData = mesh.userData || {};
        mesh.userData.loopCounterRef = loopCounterRef;
        initializeMmdLipSyncTargets(mesh);
        mesh.userData.initializeMmdLipSyncTargets = () => initializeMmdLipSyncTargets(mesh);

        // ボーンの初期状態を保存
        if (mesh.skeleton && mesh.skeleton.bones) {
          const initialState = [];
          mesh.skeleton.bones.forEach(bone => {
            initialState.push({
              bone: bone,
              position: bone.position.clone(),
              quaternion: bone.quaternion.clone(),
              scale: bone.scale.clone()
            });
          });
          initialBonesStateRef.current = initialState;
          console.log('[MMDModel] Saved initial bone states:', initialState.length);

          // メッシュと初期ボーン状態を親に通知
          // meshRefを更新する関数も一緒に渡す
          if (onMeshReadyRef.current) {
            const setMeshRef = (newMesh) => {
              meshRef.current = newMesh;
              // 簡易物理演算の初期化をリセット（クローン/リセット時）
              simplePhysicsInitializedRef.current = false;
              simplePhysicsBonesRef.current = [];
              simplePhysicsCollidersRef.current = [];
              simplePhysicsTracksRemovedRef.current = false;
              console.log('[MMDModel] meshRef.current updated to new mesh');
              console.log('[Simple Physics] Reset for mesh replacement');
            };
            onMeshReadyRef.current(mesh, initialState, setMeshRef);
          }
        }

        // 初期状態の mesh を clone して保存（リセット用）
        // SkeletonUtils.clone() を使用してボーンを含めて完全にディープコピー
        try {
          console.log('[MMDModel] Attempting to clone mesh with SkeletonUtils...');
          const clonedMesh = SkeletonUtils.clone(mesh);
          console.log('[MMDModel] Clone successful, type:', clonedMesh?.type, 'isMesh:', clonedMesh?.isMesh);

          // ★重要：originalMaterialsはclonedMeshに保存しない（クローン処理を軽量化）
          // クローン後に再収集する方式に変更（4435-4460行目参照）

          if (parentClonedMeshRef) {
            parentClonedMeshRef.current = clonedMesh;
            console.log('[MMDModel] Cloned mesh saved for reset (deep copy with SkeletonUtils)');
            console.log('[MMDModel] parentClonedMeshRef.current set:', !!parentClonedMeshRef.current);
          } else {
            console.warn('[MMDModel] parentClonedMeshRef is null/undefined');
          }
        } catch (error) {
          console.error('[MMDModel] Failed to clone mesh with SkeletonUtils:', error);
          console.error('[MMDModel] Error stack:', error.stack);
        }

        // 初期モーションの適用
        const initialVmdUrls = vmdUrlsRef.current;
        if (initialVmdUrls && initialVmdUrls.length > 0) {
          console.log('[MMDModel] Loading initial animation:', initialVmdUrls[0]);
          loader.loadAnimation(initialVmdUrls[0], mesh, (animation) => {
            console.log('[MMDModel] Initial animation loaded:', animation);
            console.log('[MMDModel] Animation duration before reset:', animation.duration);
            console.log('[MMDModel] Animation tracks:', animation.tracks?.length);

            // トラックの詳細を確認
            if (animation.tracks && animation.tracks.length > 0) {
              const firstTrack = animation.tracks[0];
              console.log('[MMDModel] First track:', {
                name: firstTrack.name,
                times: firstTrack.times?.length,
                values: firstTrack.values?.length,
                firstTime: firstTrack.times?.[0],
                lastTime: firstTrack.times?.[firstTrack.times?.length - 1]
              });

              // 全トラックの最大時間を確認
              let maxTime = 0;
              animation.tracks.forEach(track => {
                if (track.times && track.times.length > 0) {
                  const trackMax = track.times[track.times.length - 1];
                  if (trackMax > maxTime) maxTime = trackMax;
                }
              });
              console.log('[MMDModel] Max time from tracks:', maxTime);
            }

            // durationを計算
            if (animation.duration === 0 && animation.tracks && animation.tracks.length > 0) {
              animation.resetDuration();
              console.log('[MMDModel] Animation duration after reset:', animation.duration);
            }

            mesh.userData = mesh.userData || {};
            mesh.userData.currentMmdAnimationUrl = initialVmdUrls[0];

            const meshObj = applyAnimationClip(animation);
            if (meshObj?.mixer) {
              const actionCount = meshObj.mixer._actions ? meshObj.mixer._actions.length : 0;
              console.log('[MMDModel] Animation actions after apply:', actionCount);

              // 簡易物理演算が有効な場合、物理対象ボーンのVMDトラックを削除
              // （この時点ではまだ初期化されていない可能性が高いので、useFrameで処理）
            }

            if (onLoadRef.current) onLoadRef.current(mesh);
          });
        } else {
          console.log('[MMD Physics] Adding mesh with physics enabled (2-frame update, low precision)');
          console.log('[MMD Physics] Ammo available:', !!window.Ammo);
          console.log('[MMD Physics] Physics enabled:', enablePhysicsRef.current);

          try {
            helper.add(mesh, { physics: enablePhysicsRef.current && !!window.Ammo });

            // 物理演算の精度を下げて軽量化
            const meshObj = helper.objects.get(mesh);
            if (meshObj && meshObj.physics && meshObj.physics.world) {
              const world = meshObj.physics.world;
              const solverInfo = world.getSolverInfo();
              if (typeof solverInfo.set_m_numIterations === 'function') {
                solverInfo.set_m_numIterations(1);
              }
              if (typeof solverInfo.set_m_numSubSteps === 'function') {
                solverInfo.set_m_numSubSteps(0);
              }
              world.setGravity(new window.Ammo.btVector3(0, -9.8, 0));
              console.log('[MMD Physics] Low precision mode (2-frame update, reduced gravity)');
            }
          } catch (error) {
            console.error('[MMD Physics] Failed to add mesh with physics:', error);
            if (error.message && error.message.includes('OOM')) {
              console.error('[OOM Detected] Triggering model reload');
              // 物理をオフにせず、モデル全体を破棄・再ロードすることでメモリ解放
              if (window.oomCallback) {
                window.oomCallback();
              }
              return;  // 処理を中断（再ロードが始まる）
            }
            // OOM以外のエラーの場合は物理オフで再試行
            helper.add(mesh, { physics: false });
          }

          mesh.userData = mesh.userData || {};
          mesh.userData.resetMmdPose = resetMeshToInitialState;
          mesh.userData.reinitializeMmdAnimation = null;
          mesh.userData.currentMmdClip = null;

          if (onLoadRef.current) onLoadRef.current(mesh);
        }
      },
      (progress) => console.log('Loading MMD model...', (progress.loaded / progress.total) * 100, '%'),
      (error) => {
        console.error('Error loading MMD model:', error);
      }
    );

    return () => {
      console.log('[MMDModel] Cleanup - unmounting');
      cancelled = true;

      // 物理クリーンアップ関数を削除
      if (window.forceCleanupPhysics) {
        delete window.forceCleanupPhysics;
      }

      // helper cleanup existing code...
      if (helperRef.current) {
        const helper = helperRef.current;
        const mesh = meshRef.current;
        if (mesh && helper.objects && helper.objects.get(mesh)) {
          const object = helper.objects.get(mesh);
          if (object && object.mixer) {
            object.mixer.stopAllAction();
            object.mixer.uncacheRoot(mesh);
          }
          helper.remove(mesh);
        }
        helperRef.current = null;
      }

      if (meshRef.current) {
        scene.remove(meshRef.current);
        meshRef.current = null;
      }

      initialBonesStateRef.current = null;

      if (typeof resetURLModifier === 'function') {
        resetURLModifier();
      }
    };
  }, [url, scene]);

  // マテリアル調整の変更を監視（テカリと明るさ）
  useEffect(() => {
    mmdShininessRef.current = mmdShininess;
    mmdBrightnessRef.current = mmdBrightness;
    materialUpdateNeededRef.current = true;
    console.log(`[MMD Material] Material update scheduled - shininess: ${mmdShininess}, brightness: ${mmdBrightness}`);
  }, [mmdShininess, mmdBrightness]);

  // MMDスケールの変更を監視
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(mmdScale);
      console.log(`[MMD Scale] Scale updated: ${mmdScale}`);
    }
  }, [mmdScale]);

  // モーションの切り替え（vmdUrlsが変わったときのみ）
  useEffect(() => {
    console.log('[MMDModel] Motion switch effect triggered', {
      hasMesh: !!meshRef.current,
      hasLoader: !!loaderRef.current,
      hasHelper: !!helperRef.current,
      vmdUrls
    });

    if (!meshRef.current || !loaderRef.current || !helperRef.current) {
      console.log('[MMDModel] Motion switch skipped - missing refs');
      return;
    }

    if (!vmdUrls || vmdUrls.length === 0) {
      console.log('[MMDModel] Motion switch skipped - no vmdUrls');
      return;
    }

    // ループカウンターをリセット
    loopCounterRef.current.currentLoops = 0;
    loopCounterRef.current.lastTime = -1;
    console.log('[MMDModel] Loop counter reset for new motion');

    const loader = loaderRef.current;
    const mesh = meshRef.current;
    const helper = helperRef.current;

    console.log('[MMDModel] Loading animation:', vmdUrls[0]);
    loader.loadAnimation(vmdUrls[0], mesh, (animation) => {
      console.log('[MMDModel] Animation loaded, duration before:', animation.duration);

      // durationを計算
      if (animation.duration === 0 && animation.tracks && animation.tracks.length > 0) {
        animation.resetDuration();
        console.log('[MMDModel] Animation duration after reset:', animation.duration);
      }

      // durationをApp.jsxに通知
      if (onAnimationDurationRef.current && animation.duration > 0) {
        const currentVmdUrl = vmdUrlsRef.current?.[0];
        if (currentVmdUrl) {
          onAnimationDurationRef.current(currentVmdUrl, animation.duration);
        }
      }

      mesh.userData = mesh.userData || {};
      mesh.userData.currentMmdAnimationUrl = vmdUrls[0];

      const meshObj = applyAnimationClip(animation);
      if (meshObj?.mixer) {
        const actionCount = meshObj.mixer._actions ? meshObj.mixer._actions.length : 0;
        console.log('[MMDModel] Animation applied successfully:', vmdUrls[0], 'actions:', actionCount);

        // 簡易物理演算が有効な場合、物理対象ボーンのVMDトラックを削除
        if (enableSimplePhysics && simplePhysicsBonesRef.current.length > 0) {
          const physicsBoneNames = new Set(simplePhysicsBonesRef.current.map(({ bone }) => bone.name));
          let removedCount = 0;

          meshObj.mixer._actions.forEach(action => {
            const clip = action.getClip();
            if (clip && clip.tracks) {
              const originalLength = clip.tracks.length;
              clip.tracks = clip.tracks.filter(track => {
                const boneName = track.name.split('.')[0];
                return !physicsBoneNames.has(boneName);
              });
              removedCount += originalLength - clip.tracks.length;
            }
          });

          if (removedCount > 0) {
            console.log(`[Simple Physics] Removed ${removedCount} VMD tracks for physics bones (motion switch)`);
            simplePhysicsTracksRemovedRef.current = false;  // フラグリセット（次のフレームで再度削除）
          }
        }
      } else {
        console.log('[MMDModel] Animation applied without mixer access:', vmdUrls[0]);
      }

      // モーション切り替え後に lip sync targets を再初期化
      initializeMmdLipSyncTargets(mesh);
    });
  }, [vmdUrls]);

  // インタラクション処理
  useEffect(() => {
    const handleMouseMove = (event) => {
      const now = Date.now();
      const lastPos = lastMousePos.current;

      // 10秒に1回だけ反応する（パフォーマンス対策）
      const canReact = (now - lastPetReaction.current) > 10000;

      if (canReact && now - lastPos.time < 100) { // 100ms以内の連続移動
        const dx = event.clientX - lastPos.x;
        const dy = event.clientY - lastPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) { // 十分な移動距離
          petStrokes.current.push({ dx, dy, time: now });

          // 古いストロークを削除（500ms以上前）
          petStrokes.current = petStrokes.current.filter(s => now - s.time < 500);

          // 連続したストロークが5つ以上あれば撫でていると判定
          if (petStrokes.current.length >= 5) {
            lastPetReaction.current = now;

            console.log('[MMD Interaction] Petting detected');

            // onMmdInteractionMotionを呼ぶ（モーション切り替え）
            if (onMmdInteractionMotionRef.current) {
              onMmdInteractionMotionRef.current('pet');
            }

            // インタラクションコールバックを呼ぶ（音声反応）
            if (onInteractionRef.current) {
              onInteractionRef.current('pet');
            }

            petStrokes.current = [];
          }
        }
      }

      lastMousePos.current = { x: event.clientX, y: event.clientY, time: now };

      // MMDグラブモード判定と追従処理
      if (mmdIsDragging && !mmdIsGrabbing && !mmdGrabStarted) {
        const grabDuration = Date.now() - mmdDragStartTime;

        // 500ms以上長押しでグラブモード開始
        if (grabDuration >= 500 && meshRef.current && mmdGrabHitPoint) {
          console.log('[MMD Grab] Starting grab mode');
          mmdGrabStarted = true;
          mmdIsGrabbing = true;

          // 掴むボーンを特定（物理ボーン、または最も近いボーン）
          const mesh = meshRef.current;
          if (mesh.skeleton?.bones) {
            let minDistance = Infinity;

            // 掴んではいけないボーンかどうか判定（ブラックリスト方式）
            const isUngrabableBone = (bone) => {
              const name = bone.name || '';
              const lower = name.toLowerCase();

              // 顔のパーツ（目、眉、口など）
              if (lower.includes('目') || lower.includes('eye') ||
                  lower.includes('眉') || lower.includes('brow') ||
                  lower.includes('口') || lower.includes('mouth') ||
                  lower.includes('lip') || lower.includes('唇') ||
                  lower.includes('まぶた') || lower.includes('eyelid')) {
                return true;
              }

              // 頭、首
              if (lower.includes('head') || lower.includes('頭') ||
                  lower.includes('neck') || lower.includes('首')) {
                return true;
              }

              // 体幹（上半身、下半身、背骨）※胸・腰・肩は除外
              if (lower.includes('spine') || lower.includes('背') ||
                  lower.includes('上半身') || lower.includes('下半身') ||
                  lower.includes('pelvis') || lower.includes('骨盤')) {
                return true;
              }

              return false;
            };

            // タップアニメーションと同じ：hitPointから最も近いボーンを探す
            mesh.skeleton.bones.forEach(bone => {
              if (isUngrabableBone(bone)) return;

              const boneWorldPos = new THREE.Vector3();
              bone.getWorldPosition(boneWorldPos);
              const distance = mmdGrabHitPoint.distanceTo(boneWorldPos);

              if (distance < minDistance) {
                minDistance = distance;
                mmdGrabbedBone = bone;
              }
            });

            if (mmdGrabbedBone) {
              // 元の位置と回転を保存
              mmdGrabbedBoneOriginalPos = mmdGrabbedBone.position.clone();
              mmdGrabbedBoneOriginalRot = mmdGrabbedBone.quaternion.clone();

              // グラブ状態をRefに保存
              mmdGrabStateRef.current.isGrabbing = true;
              mmdGrabStateRef.current.grabbedBone = mmdGrabbedBone;
              mmdGrabStateRef.current.grabHitDistance = mmdGrabHitPoint.distanceTo(camera.position);

              console.log('[MMD Grab] Grabbed bone:', mmdGrabbedBone.name);

              // グラブインタラクションコールバックを呼ぶ
              const bodyPart = getBoneCategory(mmdGrabbedBone.name);
              if (onInteractionRef.current) {
                onInteractionRef.current({
                  type: 'grab',
                  bodyPart,
                  boneName: mmdGrabbedBone.name
                });
              }
            }
          }
        }
      }

      // MMDグラブ中：マウス位置のワールド座標を計算して保存
      if (mmdIsGrabbing && mmdGrabbedBone) {
        const canvas = gl.domElement;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        // レイキャストでマウス位置のワールド座標を取得
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // カメラから一定距離の位置をターゲットとする
        const targetPos = new THREE.Vector3();
        raycaster.ray.at(mmdGrabStateRef.current.grabHitDistance, targetPos);

        // ターゲット位置を保存（useFrame内で適用）
        mmdGrabStateRef.current.targetWorldPos = targetPos;
      }
    };

    let mmdIsDragging = false;
    let mmdDragStartPos = null;
    let mmdDragStartTime = 0;

    // MMDグラブ機能用の変数
    let mmdIsGrabbing = false;
    let mmdGrabbedBone = null;
    let mmdGrabbedBoneOriginalPos = null;
    let mmdGrabbedBoneOriginalRot = null;
    let mmdGrabHitPoint = null;
    let mmdGrabStarted = false;

    const handleMMDMouseDown = (event) => {
      if (!meshRef.current) return;

      // Raycasterでクリック位置を検出（canvasベースの座標）
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(meshRef.current, true);

      if (intersects.length > 0) {
        console.log('[MMD Interaction] Mouse down on MMD model');
        mmdIsDragging = true;
        mmdDragStartPos = { x: event.clientX, y: event.clientY };
        mmdDragStartTime = Date.now();

        // グラブ用の初期情報を保存
        mmdGrabHitPoint = intersects[0].point.clone();
        mmdGrabStarted = false;
        mmdIsGrabbing = false;
      }
    };

    const handleMMDMouseUp = (event) => {
      // MMDグラブ中の場合はリリース処理
      if (mmdIsGrabbing && mmdGrabbedBone && mmdGrabbedBoneOriginalPos) {
        console.log('[MMD Grab] Releasing grabbed bone');

        // アニメーションで元の位置に戻す（ボーンへの参照をローカル変数に保存）
        const boneToAnimate = mmdGrabbedBone;
        const startPos = mmdGrabbedBone.position.clone();
        const startRot = mmdGrabbedBone.quaternion.clone();
        const targetPos = mmdGrabbedBoneOriginalPos;
        const targetRot = mmdGrabbedBoneOriginalRot;
        const duration = 500; // 500ms
        const startTime = Date.now();

        const animateBack = () => {
          if (!boneToAnimate) return; // 念のためnullチェック

          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // イージング関数（ease-out）
          const eased = 1 - Math.pow(1 - progress, 3);

          // 位置を補間
          boneToAnimate.position.lerpVectors(startPos, targetPos, eased);
          boneToAnimate.quaternion.slerpQuaternions(startRot, targetRot, eased);

          if (progress < 1) {
            requestAnimationFrame(animateBack);
          } else {
            console.log('[MMD Grab] Animation complete');
          }
        };

        animateBack();

        // グラブ状態をリセット
        mmdIsGrabbing = false;
        mmdGrabbedBone = null;
        mmdGrabbedBoneOriginalPos = null;
        mmdGrabbedBoneOriginalRot = null;
        mmdGrabStarted = false;
        mmdIsDragging = false;
        mmdDragStartPos = null;

        // Refもリセット
        mmdGrabStateRef.current.isGrabbing = false;
        mmdGrabStateRef.current.grabbedBone = null;
        mmdGrabStateRef.current.targetWorldPos = null;
        mmdGrabStateRef.current.grabHitDistance = null;

        return;
      }

      if (!mmdIsDragging) return;

      const now = Date.now();
      const canReact = (now - lastTapReaction.current) > 10000;

      if (!canReact) {
        mmdIsDragging = false;
        mmdDragStartPos = null;
        return;
      }

      const dragDistance = mmdDragStartPos ?
        Math.sqrt(
          Math.pow(event.clientX - mmdDragStartPos.x, 2) +
          Math.pow(event.clientY - mmdDragStartPos.y, 2)
        ) : 0;

      const dragDuration = Date.now() - mmdDragStartTime;

      // ドラッグ距離が短く、時間も短ければタップ
      if (dragDistance < 10 && dragDuration < 200) {
        lastTapReaction.current = now;

        // Raycasterで部位検出とエフェクト
        const canvas = gl.domElement;
        const rect = canvas.getBoundingClientRect();
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(meshRef.current, true);

        let tappedBoneName = null;
        let bodyPart = 'default';

        if (intersects.length > 0) {
          const hitPoint = intersects[0].point;

          // クリックサークルアニメーション
          if (onTapEffectRef.current) {
            onTapEffectRef.current(event.clientX, event.clientY);
          }

          // 最も近いボーンを検出
          const mesh = meshRef.current;
          let tappedBone = null;
          if (mesh.skeleton && mesh.skeleton.bones) {
            let minDistance = Infinity;

            mesh.skeleton.bones.forEach(bone => {
              const boneWorldPos = new THREE.Vector3();
              bone.getWorldPosition(boneWorldPos);
              const distance = hitPoint.distanceTo(boneWorldPos);
              if (distance < minDistance) {
                minDistance = distance;
                tappedBoneName = bone.name;
                tappedBone = bone; // ボーンオブジェクトも保存
              }
            });

            bodyPart = getBoneCategory(tappedBoneName);

            // 【デバッグ】ボーンの詳細情報を取得
            if (tappedBone) {
              console.log('=== [MMD Bone Debug] Tapped Bone Details ===');
              console.log('Name:', tappedBone.name);
              console.log('Type:', tappedBone.type);
              console.log('Children count:', tappedBone.children.length);

              // 親ボーン情報
              let currentBone = tappedBone;
              let depth = 0;
              const hierarchy = [];
              while (currentBone && depth < 10) {
                hierarchy.push({
                  depth,
                  name: currentBone.name || 'unnamed',
                  type: currentBone.type,
                  childrenCount: currentBone.children.length
                });
                currentBone = currentBone.parent;
                depth++;
              }
              console.log('Hierarchy (child -> root):', hierarchy);

              // 物理ボディの有無をチェック
              const helper = helperRef.current;
              const meshObj = helper?.objects?.get(mesh);
              if (meshObj?.physics?.bodies) {
                const physicsBody = meshObj.physics.bodies.find(bodyWrapper => {
                  const body = bodyWrapper?.body || bodyWrapper;
                  return body?.bone === tappedBone;
                });
                console.log('Has physics body:', !!physicsBody);
                if (physicsBody) {
                  const body = physicsBody?.body || physicsBody;
                  console.log('Physics body type:', body?.constructor?.name);
                }
              }

              // スキニングウェイト情報（メッシュに影響があるか）
              let hasSkinningWeight = false;
              mesh.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                  const boneIndex = child.skeleton.bones.indexOf(tappedBone);
                  if (boneIndex !== -1 && child.geometry?.attributes?.skinWeight) {
                    const skinWeights = child.geometry.attributes.skinWeight.array;
                    const skinIndices = child.geometry.attributes.skinIndex.array;

                    // このボーンが頂点に影響しているかチェック
                    for (let i = 0; i < skinIndices.length; i += 4) {
                      for (let j = 0; j < 4; j++) {
                        if (skinIndices[i + j] === boneIndex && skinWeights[i + j] > 0) {
                          hasSkinningWeight = true;
                          break;
                        }
                      }
                      if (hasSkinningWeight) break;
                    }
                  }
                }
              });
              console.log('Has skinning weight (affects mesh):', hasSkinningWeight);
              console.log('==========================================');
            }

            // GPT-5 nanoで部位カテゴリを判定（非同期）
            if (tappedBoneName && aiStatus === 'ready') {
              (async () => {
                try {
                  const categoryResult = await aiService.simpleQuery(
                    `ボーン名: "${tappedBoneName}"\n\nこのボーンは以下のどのカテゴリに属しますか？カテゴリ名のみ答えてください：\n- intimate（胸、腰、太もも、お尻など親密な部位）\n- head（頭、顔）\n- shoulder（肩）\n- arm（腕、手）\n- leg（脛、足）\n- default（その他）`,
                    'あなたは3Dモデルのボーン名から体の部位カテゴリを判定するAIです。カテゴリ名のみ答えてください。',
                    { model: 'gpt-5-nano', maxTokens: 20 }
                  );
                  const gptCategory = categoryResult.trim().toLowerCase();
                  const validCategories = ['intimate', 'head', 'shoulder', 'arm', 'leg', 'default'];
                  const finalCategory = validCategories.includes(gptCategory) ? gptCategory : bodyPart;

                  console.log('[GPT-5 nano] MMD Body part category:', { boneName: tappedBoneName, getBoneCategory: bodyPart, gptCategory: finalCategory });

                  // GPT-5 nanoの判定結果をonInteractionコールバックで通知
                  if (onInteractionRef.current) {
                    onInteractionRef.current({
                      type: 'tap',
                      bodyPart: finalCategory,
                      boneName: tappedBoneName,
                      position: hitPoint,
                      source: 'gpt5nano'
                    });
                    console.log('[GPT-5 nano] MMD interaction with GPT category:', finalCategory);
                  }
                } catch (error) {
                  console.error('[GPT-5 nano] Failed to identify MMD body part category:', error);
                }
              })();
            }

            // 物理演算オンの場合：Ammo.jsの物理ボディに外圧を加える（VRMのspring boneと同じ仕組み）
            const helper = helperRef.current;
            const meshObj = helper?.objects?.get(mesh);
            const hasPhysics = enablePhysicsRef.current && meshObj?.physics?.bodies && window.Ammo;

            if (hasPhysics) {
              // 物理演算オン：Ammo物理ボディにインパルスを適用
              console.log('[MMD Physics Impulse] Applying impulse to rigid bodies');

              const impulseStrength = 8.0; // VRMより強く（VRM: 3.5）
              let affectedBodies = 0;

              // タップしたボーン + 親2階層 + 子孫全てを収集
              const affectedBones = new Set();

              // 1. 親ボーンを2階層まで収集（子要素数が2以上の親はスキップ、かつ25cm以内のみ、揺らせないボーンは除外）
              const maxDistance = 0.25; // 25cm
              const isUngrabableBone = (bone) => {
                const name = bone.name || '';
                const lower = name.toLowerCase();

                // 顔のパーツ（目、眉、口など）
                if (lower.includes('目') || lower.includes('eye') ||
                    lower.includes('眉') || lower.includes('brow') ||
                    lower.includes('口') || lower.includes('mouth') ||
                    lower.includes('lip') || lower.includes('唇') ||
                    lower.includes('まぶた') || lower.includes('eyelid')) {
                  return true;
                }

                // 頭、首
                if (lower.includes('head') || lower.includes('頭') ||
                    lower.includes('neck') || lower.includes('首')) {
                  return true;
                }

                // 体幹（上半身、下半身、背骨）※胸・腰・肩は除外
                if (lower.includes('spine') || lower.includes('背') ||
                    lower.includes('上半身') || lower.includes('下半身') ||
                    lower.includes('pelvis') || lower.includes('骨盤')) {
                  return true;
                }

                return false;
              };

              let currentParent = tappedBone.parent;
              let parentDepth = 0;
              while (currentParent && parentDepth < 2) {
                if (currentParent.type === 'Bone' || currentParent.isBone) {
                  const parentWorldPos = new THREE.Vector3();
                  currentParent.getWorldPosition(parentWorldPos);
                  const distance = hitPoint.distanceTo(parentWorldPos);

                  // 子要素数が2以上、または距離が25cm以上、または揺らせないボーンならスキップ
                  if (currentParent.children.length < 2 && distance <= maxDistance && !isUngrabableBone(currentParent)) {
                    affectedBones.add(currentParent);
                    console.log(`[MMD Physics] Parent ${parentDepth + 1}: ${currentParent.name} (children: ${currentParent.children.length}, distance: ${distance.toFixed(3)}m)`);
                  } else {
                    console.log(`[MMD Physics] Skipped parent ${parentDepth + 1}: ${currentParent.name} (children: ${currentParent.children.length}, distance: ${distance.toFixed(3)}m, isUngrabable: ${isUngrabableBone(currentParent)})`);
                  }
                  currentParent = currentParent.parent;
                  parentDepth++;
                } else {
                  break;
                }
              }

              // 2. タップしたボーン自身を追加（揺らせないボーンでなければ）
              if (!isUngrabableBone(tappedBone)) {
                affectedBones.add(tappedBone);
              }

              // 3. 子孫ボーンを再帰的に収集（揺らせないボーンは除外）
              const collectDescendants = (bone) => {
                bone.children.forEach(child => {
                  if ((child.type === 'Bone' || child.isBone) && !isEyeBone(child)) {
                    affectedBones.add(child);
                    collectDescendants(child);
                  }
                });
              };
              collectDescendants(tappedBone);

              // 4. 収集したボーンに対応する物理ボディにインパルスを適用
              meshObj.physics.bodies.forEach((bodyWrapper) => {
                const body = bodyWrapper?.body || bodyWrapper;
                if (!body || !body.bone) return;

                if (affectedBones.has(body.bone)) {
                  const boneWorldPos = new THREE.Vector3();
                  body.bone.getWorldPosition(boneWorldPos);

                  const direction = new THREE.Vector3()
                    .subVectors(boneWorldPos, hitPoint)
                    .normalize();

                  const impulse = direction.multiplyScalar(impulseStrength);

                  // Ammo.jsのインパルスを適用
                  const ammoImpulse = new window.Ammo.btVector3(impulse.x, impulse.y, impulse.z);
                  if (typeof body.applyCentralImpulse === 'function') {
                    body.applyCentralImpulse(ammoImpulse);
                    body.activate(true); // 物理ボディをアクティブ化
                    affectedBodies++;
                  }
                  window.Ammo.destroy(ammoImpulse);
                }
              });

              console.log(`[MMD Physics Impulse] Applied impulse to ${affectedBodies} rigid bodies`);
            }

            // 物理演算オフの場合：ボーンアニメーションで揺れエフェクト
            if (!hasPhysics && mesh && mesh.skeleton && tappedBone) {
              console.log('[MMD Shake] Starting shake animation');
              console.log('[MMD Shake] Tapped bone:', tappedBone.name, 'type:', tappedBone.type);

              const baseAmplitude = 0.38; // 基本振幅（38cm）
              const boneAnimations = [];
              const affectedBones = new Set();

              // 揺らしてはいけないボーンを除外するフィルター（ブラックリスト方式）
              const isUngrabableBone = (bone) => {
                const name = bone.name || '';
                const lower = name.toLowerCase();

                // 顔のパーツ（目、眉、口など）
                if (lower.includes('目') || lower.includes('eye') ||
                    lower.includes('眉') || lower.includes('brow') ||
                    lower.includes('口') || lower.includes('mouth') ||
                    lower.includes('lip') || lower.includes('唇') ||
                    lower.includes('まぶた') || lower.includes('eyelid')) {
                  return true;
                }

                // 頭、首
                if (lower.includes('head') || lower.includes('頭') ||
                    lower.includes('neck') || lower.includes('首')) {
                  return true;
                }

                // 体幹（上半身、下半身、背骨）※胸・腰・肩は除外
                if (lower.includes('spine') || lower.includes('背') ||
                    lower.includes('上半身') || lower.includes('下半身') ||
                    lower.includes('pelvis') || lower.includes('骨盤')) {
                  return true;
                }

                return false;
              };

              // 1. 親ボーンを2階層まで収集（子要素数が2以上の親はスキップ、かつ25cm以内のみ、揺らせないボーンは除外）
              const maxDistance = 0.25; // 25cm
              let currentParent = tappedBone.parent;
              let parentDepth = 0;
              while (currentParent && parentDepth < 2) {
                if (currentParent.type === 'Bone' || currentParent.isBone) {
                  const parentWorldPos = new THREE.Vector3();
                  currentParent.getWorldPosition(parentWorldPos);
                  const distance = hitPoint.distanceTo(parentWorldPos);

                  // 子要素数が2以上、または距離が25cm以上、または揺らせないボーンならスキップ
                  if (currentParent.children.length < 2 && distance <= maxDistance && !isUngrabableBone(currentParent)) {
                    affectedBones.add(currentParent);
                    console.log(`[MMD Shake] Parent ${parentDepth + 1}: ${currentParent.name} (children: ${currentParent.children.length}, distance: ${distance.toFixed(3)}m)`);
                  } else {
                    console.log(`[MMD Shake] Skipped parent ${parentDepth + 1}: ${currentParent.name} (children: ${currentParent.children.length}, distance: ${distance.toFixed(3)}m, isUngrabable: ${isUngrabableBone(currentParent)})`);
                  }
                  currentParent = currentParent.parent;
                  parentDepth++;
                } else {
                  break;
                }
              }

              // 2. タップしたボーン自身を追加（揺らせないボーンでなければ）
              if (!isUngrabableBone(tappedBone)) {
                affectedBones.add(tappedBone);
              }

              // 3. 子孫ボーンを再帰的に収集（揺らせないボーンは除外）
              const collectDescendants = (bone, depth = 0) => {
                console.log(`[MMD Shake] Child ${depth}: ${bone.name || 'unnamed'}`);
                bone.children.forEach(child => {
                  if ((child.type === 'Bone' || child.isBone) && !isUngrabableBone(child)) {
                    affectedBones.add(child);
                    collectDescendants(child, depth + 1);
                  }
                });
              };
              collectDescendants(tappedBone, 1);

              // 4. 収集したボーンに揺れアニメーションを適用
              affectedBones.forEach(bone => {
                const boneWorldPos = new THREE.Vector3();
                bone.getWorldPosition(boneWorldPos);

                // タップ方向（ボーンが外向きに動く）
                const direction = new THREE.Vector3()
                  .subVectors(boneWorldPos, hitPoint)
                  .normalize();

                // 初期位置を保存
                const initialPos = bone.position.clone();
                const initialRot = bone.quaternion.clone();

                // 揺れアニメーション情報を保存
                boneAnimations.push({
                  bone,
                  direction,
                  amplitude: baseAmplitude,
                  initialPos,
                  initialRot,
                  startTime: performance.now(),
                  frequency: 3 + Math.random() * 2, // 3-5Hz
                  damping: 2.0 // 減衰率
                });
              });

              console.log(`[MMD Shake] Collected ${boneAnimations.length} bones for animation`);

              if (boneAnimations.length > 0) {
                // 既存のアニメーションに追加
                if (!mesh.userData.tapAnimations) {
                  mesh.userData.tapAnimations = [];
                }
                mesh.userData.tapAnimations.push(...boneAnimations);
                console.log(`[MMD Interaction] Started bone shake animation for ${boneAnimations.length} bones (bone: ${tappedBoneName})`);
              } else {
                console.warn('[MMD Shake] No bones collected for animation');
              }
            } else {
              console.warn('[MMD Shake] Missing requirements:', {
                mesh: !!mesh,
                skeleton: !!mesh?.skeleton,
                tappedBone: !!tappedBone
              });
            }

            console.log('[MMD Interaction] Tapped on MMD model - bone:', tappedBoneName, 'bodyPart:', bodyPart);
          }
        }

        // onMmdInteractionMotionを呼ぶ（モーション切り替え）
        if (onMmdInteractionMotionRef.current) {
          onMmdInteractionMotionRef.current('tap');
        }

        // インタラクションコールバックはGPT判定後に呼ぶ（2530-2536行目）
        // ローカル判定での即座の呼び出しは削除
      }

      mmdIsDragging = false;
      mmdDragStartPos = null;
    };

    const canvas = gl.domElement;
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMMDMouseDown);
    canvas.addEventListener('mouseup', handleMMDMouseUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMMDMouseDown);
      canvas.removeEventListener('mouseup', handleMMDMouseUp);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const helper = helperRef.current;
    if (!helper) return;

    const mesh = meshRef.current;
    if (!mesh || !helper.objects) return;

    // クローン再構築時のフラグをチェック
    if (mesh.userData.materialUpdateNeeded) {
      mesh.userData.materialUpdateNeeded = false;
      materialUpdateNeededRef.current = true;
    }

    // マテリアル調整（リアルタイム更新）
    if (materialUpdateNeededRef.current && mesh.userData.originalMaterials) {
      materialUpdateNeededRef.current = false;
      const shininess = mmdShininessRef.current;
      const brightness = mmdBrightnessRef.current;

      mesh.userData.originalMaterials.forEach(({ material, originalColor }) => {
        if (material.shininess !== undefined) {
          material.shininess = shininess;
        }
        if (originalColor && material.color && typeof material.color.copy === 'function') {
          material.color.copy(originalColor).multiplyScalar(brightness);
        }
        material.needsUpdate = true; // マテリアル更新を強制
      });
      console.log(`[MMD Material] Applied in useFrame - shininess: ${shininess}, brightness: ${brightness}`);
    }

    const meshObj = helper.objects.get(mesh);

    // isSpeaking=trueの時のみ、VMDの口モーフを無効化（それ以外は何もしない＝VMDの口をそのまま使う）
    if (isSpeaking && meshObj && meshObj.mixer && meshObj.mixer._actions.length > 0) {
      if (!window.__facialTrackFreezeShown) {
        console.log('[MMD LipSync] Freezing mouth morphs - isSpeaking=true');
        window.__facialTrackFreezeShown = true;
        setTimeout(() => { window.__facialTrackFreezeShown = false; }, 2000);
      }

      const action = meshObj.mixer._actions[0];
      const clip = action._clip;
      if (clip && clip.tracks) {
        // 口のモーフだけを無効化（母音 + その他の口関連）
        const mouthMorphPatterns = [
          'あ', 'い', 'う', 'え', 'お', 'a', 'i', 'u', 'e', 'o',
          'ワ', 'ω', '▲', '▼'
        ];

        clip.tracks.forEach(track => {
          if (track.name && track.name.includes('.morphTargetInfluences[')) {
            const match = track.name.match(/\.morphTargetInfluences\[(\d+)\]/);
            if (match) {
              const morphIndex = parseInt(match[1]);

              mesh.traverse((child) => {
                if (child.morphTargetDictionary && child.morphTargetInfluences) {
                  const morphName = Object.keys(child.morphTargetDictionary).find(
                    name => child.morphTargetDictionary[name] === morphIndex
                  );

                  // 口のモーフだけを0にする
                  if (morphName && mouthMorphPatterns.some(pattern => morphName.includes(pattern))) {
                    for (let i = 0; i < track.values.length; i++) {
                      track.values[i] = 0;
                    }
                  }
                }
              });
            }
          }
        });
      }
    }
    // isSpeaking=falseの時は何もしない → VMDの口がそのまま使われる

    // helper.update() を実行（フェイシャルトラックがfreezeされた状態で）
    const clampedDelta = Math.min(delta, 0.1); // 最大100ms（10fps相当）に制限
    helper.update(clampedDelta);

    // グラブ中のボーン位置更新（helper.update()の後に適用）
    if (mmdGrabStateRef.current.isGrabbing && mmdGrabStateRef.current.grabbedBone && mmdGrabStateRef.current.targetWorldPos) {
      const bone = mmdGrabStateRef.current.grabbedBone;
      const targetWorldPos = mmdGrabStateRef.current.targetWorldPos;

      // ターゲット位置をボーンの親のローカル座標に変換
      if (bone.parent) {
        const parentWorldMatrixInv = new THREE.Matrix4().copy(bone.parent.matrixWorld).invert();
        const localTargetPos = targetWorldPos.clone().applyMatrix4(parentWorldMatrixInv);
        bone.position.copy(localTargetPos);
      }
    }

    // 簡易物理演算を適用
    if (enableSimplePhysics && mesh && mesh.skeleton && simplePhysicsBonesRef.current.length > 0) {
      const physicsBones = simplePhysicsBonesRef.current;
      const pool = physicsResourcePool.current;
      const gravityStrength = 1.5;  // 重力を弱めて自然な動きに
      const inertiaStrength = 0.7;  // 慣性を強めて揺れやすく

      if (Math.random() < 0.01) {
        console.log('[Simple Physics] Applying physics to', physicsBones.length, 'bones');
      }

      physicsBones.forEach((data) => {
        const { bone, restRotation, angularVelocity, parentPrevRotation, mass, stiffness, dampingRatio } = data;

        // 計算済み減衰係数（critical damping formula）
        const damping = 2.0 * dampingRatio * Math.sqrt(stiffness * mass);

        // 1. スプリングトルク（初期姿勢に戻ろうとする力 - 極めて弱い）
        const deltaQ = pool.getQuaternion();
        deltaQ.copy(bone.quaternion).multiply(data.restRotation.clone().invert());
        const angle = 2 * Math.acos(Math.min(1, Math.abs(deltaQ.w)));

        const springTorque = pool.getVector3();
        if (angle > 0.001) {
          springTorque.set(deltaQ.x, deltaQ.y, deltaQ.z).normalize();
          springTorque.multiplyScalar(-stiffness * angle * 0.01);  // 0.01倍で極めて弱く（自由に揺れる）
        }

        // 2. 減衰トルク（角速度を減衰）
        const dampingTorque = pool.getVector3();
        dampingTorque.copy(angularVelocity).multiplyScalar(-damping);

        // 3. 重力トルク
        const boneWorldDir = pool.getVector3();
        boneWorldDir.set(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(pool.getQuaternion()));
        const gravityDir = pool.getVector3();
        gravityDir.set(0, -1, 0);

        const gravityTorque = pool.getVector3();
        gravityTorque.crossVectors(gravityDir, boneWorldDir);
        const gravityMag = gravityTorque.length() * gravityStrength * clampedDelta;
        if (gravityMag > 0.001) {
          gravityTorque.normalize();
          if (bone.parent) {
            const parentWorldQ = pool.getQuaternion();
            bone.parent.getWorldQuaternion(parentWorldQ);
            parentWorldQ.invert();
            gravityTorque.applyQuaternion(parentWorldQ);
            pool.releaseQuaternion(parentWorldQ);
          }
          gravityTorque.multiplyScalar(gravityMag);
        } else {
          gravityTorque.set(0, 0, 0);
        }

        // 4. 親の慣性トルク
        const inertiaTorque = pool.getVector3();
        if (bone.parent && parentPrevRotation) {
          const parentCurrentQ = pool.getQuaternion();
          parentCurrentQ.copy(bone.parent.quaternion);

          const parentDeltaQ = pool.getQuaternion();
          parentDeltaQ.multiplyQuaternions(parentCurrentQ, parentPrevRotation.clone().invert());

          const parentAngle = 2 * Math.acos(Math.min(1, Math.abs(parentDeltaQ.w)));
          if (parentAngle > 0.001) {
            inertiaTorque.set(parentDeltaQ.x, parentDeltaQ.y, parentDeltaQ.z).normalize();
            inertiaTorque.multiplyScalar(parentAngle * inertiaStrength);
          }

          parentPrevRotation.copy(parentCurrentQ);
          pool.releaseQuaternion(parentCurrentQ);
          pool.releaseQuaternion(parentDeltaQ);
        }

        // 5. 全トルクを合算して角速度を更新
        const totalTorque = pool.getVector3();
        totalTorque.copy(springTorque).add(dampingTorque).add(gravityTorque).add(inertiaTorque);
        angularVelocity.add(totalTorque.multiplyScalar(clampedDelta / mass));

        // 6. 角速度を回転に積分（指数写像による高精度積分）
        const halfAngleVec = pool.getVector3();
        halfAngleVec.copy(angularVelocity).multiplyScalar(clampedDelta * 0.5);
        const halfAngle = halfAngleVec.length();

        if (halfAngle > 0.0001) {
          const deltaRot = pool.getQuaternion();
          if (halfAngle < 0.01) {
            // 小角度近似
            deltaRot.set(halfAngleVec.x, halfAngleVec.y, halfAngleVec.z, 1.0).normalize();
          } else {
            // 完全な指数写像
            const c = Math.cos(halfAngle);
            const s = Math.sin(halfAngle) / halfAngle;
            deltaRot.set(halfAngleVec.x * s, halfAngleVec.y * s, halfAngleVec.z * s, c);
          }
          bone.quaternion.multiply(deltaRot);
          bone.quaternion.normalize();
          pool.releaseQuaternion(deltaRot);
        }

        // 7. 距離制約（親からの距離を維持）
        if (bone.parent && data.restLength > 0) {
          const parentPos = pool.getVector3();
          const bonePos = pool.getVector3();
          bone.parent.getWorldPosition(parentPos);
          bone.getWorldPosition(bonePos);

          const delta = pool.getVector3();
          delta.copy(bonePos).sub(parentPos);
          const currentLength = delta.length();

          if (currentLength > 0.0001) {
            const diff = currentLength - data.restLength;
            if (Math.abs(diff) > 0.001) {
              const correction = delta.multiplyScalar(diff / currentLength);
              const compliance = 0.5; // 柔らかさをさらに上げて自然な伸縮を許容（0=剛体、1=完全に柔軟）
              const effectiveCompliance = compliance / (clampedDelta * clampedDelta);
              const correctionScale = 1.0 / (1.0 + effectiveCompliance);

              bonePos.sub(correction.multiplyScalar(correctionScale));

              // ローカル座標に変換
              if (bone.parent) {
                bone.parent.worldToLocal(bonePos);
                bone.position.copy(bonePos);
              }
            }
          }

          pool.releaseVector3(parentPos);
          pool.releaseVector3(bonePos);
          pool.releaseVector3(delta);
        }

        // 8. 衝突判定と応答
        const colliders = simplePhysicsCollidersRef.current;
        if (colliders.length > 0) {
          const boneWorldPos = pool.getVector3();
          bone.getWorldPosition(boneWorldPos);

          colliders.forEach(collider => {
            const colliderWorldPos = pool.getVector3();
            collider.bone.getWorldPosition(colliderWorldPos);
            colliderWorldPos.add(collider.offset);

            let penetration = 0;
            const pushDir = pool.getVector3();

            if (collider.type === 'sphere') {
              // 球体コライダーとの衝突判定
              pushDir.copy(boneWorldPos).sub(colliderWorldPos);
              const distance = pushDir.length();
              penetration = collider.radius - distance;

              if (penetration > 0 && distance > 0.0001) {
                // 衝突している：押し出し
                pushDir.normalize().multiplyScalar(penetration);
                boneWorldPos.add(pushDir);

                // 速度の反射（貫通を防ぐ）
                const normalDot = pushDir.normalize().dot(angularVelocity);
                if (normalDot < 0) {
                  angularVelocity.addScaledVector(pushDir, -normalDot * 0.5);
                }
              }
            } else if (collider.type === 'capsule') {
              // カプセルコライダーとの衝突判定
              const capsuleHead = pool.getVector3();
              const capsuleTail = pool.getVector3();
              capsuleHead.copy(colliderWorldPos);
              capsuleTail.copy(colliderWorldPos).add(collider.tail);

              // ボーンから線分への最近接点を計算
              const lineDir = pool.getVector3();
              lineDir.copy(capsuleTail).sub(capsuleHead);
              const lineLength = lineDir.length();

              if (lineLength > 0.0001) {
                lineDir.normalize();
                const toPoint = pool.getVector3();
                toPoint.copy(boneWorldPos).sub(capsuleHead);
                const t = Math.max(0, Math.min(lineLength, toPoint.dot(lineDir)));

                const closestPoint = pool.getVector3();
                closestPoint.copy(capsuleHead).addScaledVector(lineDir, t);

                pushDir.copy(boneWorldPos).sub(closestPoint);
                const distance = pushDir.length();
                penetration = collider.radius - distance;

                if (penetration > 0 && distance > 0.0001) {
                  // 衝突している：押し出し
                  pushDir.normalize().multiplyScalar(penetration);
                  boneWorldPos.add(pushDir);

                  // 速度の反射
                  const normalDot = pushDir.normalize().dot(angularVelocity);
                  if (normalDot < 0) {
                    angularVelocity.addScaledVector(pushDir, -normalDot * 0.5);
                  }
                }

                pool.releaseVector3(toPoint);
                pool.releaseVector3(closestPoint);
              }

              pool.releaseVector3(lineDir);
              pool.releaseVector3(capsuleHead);
              pool.releaseVector3(capsuleTail);
            }

            pool.releaseVector3(colliderWorldPos);
            pool.releaseVector3(pushDir);
          });

          // 衝突応答後の位置をボーンに反映
          if (bone.parent) {
            bone.parent.worldToLocal(boneWorldPos);
            bone.position.copy(boneWorldPos);
          }

          pool.releaseVector3(boneWorldPos);
        }

        bone.updateMatrix();
        data.prevRotation.copy(bone.quaternion);

        // プールにリソースを返却
        pool.releaseQuaternion(deltaQ);
        pool.releaseVector3(springTorque);
        pool.releaseVector3(dampingTorque);
        pool.releaseVector3(boneWorldDir);
        pool.releaseVector3(gravityDir);
        pool.releaseVector3(gravityTorque);
        pool.releaseVector3(inertiaTorque);
        pool.releaseVector3(totalTorque);
        pool.releaseVector3(halfAngleVec);
      });

      mesh.skeleton.bones[0].updateMatrixWorld(true);
    }

    // タップアニメーションの更新（減衰振動でボーンを揺らす）
    if (mesh && mesh.userData.tapAnimations && mesh.userData.tapAnimations.length > 0) {
      const now = performance.now();
      const activeAnimations = [];

      mesh.userData.tapAnimations.forEach(anim => {
        const elapsed = (now - anim.startTime) / 1000; // 秒に変換
        const { bone, direction, amplitude, initialPos, frequency, damping } = anim;

        // 減衰振動の計算: amplitude * sin(frequency * t) * exp(-damping * t)
        const dampingFactor = Math.exp(-damping * elapsed);
        const oscillation = Math.sin(frequency * Math.PI * 2 * elapsed);
        const currentAmplitude = amplitude * oscillation * dampingFactor;

        // ボーン位置を更新（初期位置からの相対移動）
        bone.position.copy(initialPos).add(
          direction.clone().multiplyScalar(currentAmplitude)
        );

        // 減衰が十分小さくなったら終了（振幅が1mm以下）
        if (Math.abs(currentAmplitude) > 0.001 && dampingFactor > 0.01) {
          activeAnimations.push(anim);
        } else {
          // アニメーション終了：元の位置に戻す
          bone.position.copy(initialPos);
        }
      });

      // アクティブなアニメーションだけを残す
      mesh.userData.tapAnimations = activeAnimations;
    }

    // 簡易物理演算（軽量版・実験的）
    if (enableSimplePhysics && mesh && mesh.skeleton) {
      // PMX物理設定の確認（デバッグ）
      if (!window.__pmxPhysicsChecked) {
        console.log('[Simple Physics] meshObj exists:', !!meshObj);
        console.log('[Simple Physics] meshObj.physics exists:', !!(meshObj && meshObj.physics));
        console.log('[Simple Physics] enablePhysics:', enablePhysics);

        if (meshObj && meshObj.physics) {
          console.log('[Simple Physics] PMX physics data:', meshObj.physics);
          console.log('[Simple Physics] RigidBodies:', meshObj.physics.bodies?.length || 0);
          console.log('[Simple Physics] Constraints:', meshObj.physics.constraints?.length || 0);
          if (meshObj.physics.bodies && meshObj.physics.bodies.length > 0) {
            console.log('[Simple Physics] Sample RigidBody:', meshObj.physics.bodies[0]);
          }
        } else {
          console.warn('[Simple Physics] PMX physics not available. Enable MMD physics first to load physics data, then you can switch to simple physics.');
        }
        window.__pmxPhysicsChecked = true;
      }

      // 初期化：物理対象ボーンを検出
      if (!simplePhysicsInitializedRef.current) {
        console.log('[Simple Physics] Initializing... enableSimplePhysics:', enableSimplePhysics);
        console.log('[Simple Physics] Total bones:', mesh.skeleton.bones.length);

        const physicsTargetPatterns = [
          /髪|hair|前髪|後髪|横髪|ponytail|ポニー|ツインテ|twin/i,
          /スカート|skirt/i,
          /尻尾|tail|しっぽ/i,
          /リボン|ribbon/i,
          /袖|sleeve/i,
          /胸|breast|bust|おっぱい|乳|mune|oppai|chest|boob/i,
          /服|cloth|衣装/i,
          /アクセサリ|accessory/i,
          /耳|ear/i,
          /帽子|hat|cap/i,
          /マント|cloak|cape/i,
          /ネクタイ|necktie|tie/i
        ];

        const physicsBones = [];
        const addedBones = new Set(); // 重複を避けるため

        // ボーンタイプに応じた物理パラメータを決定
        const getBonePhysicsParams = (boneName) => {
          const name = boneName.toLowerCase();

          // 髪：非常に柔らかく（stiffness極小でフワフワに）
          if (/髪|hair|前髪|後髪|横髪|ponytail|ポニー|ツインテ|twin/.test(name)) {
            return { mass: 1.5, stiffness: 2.0, dampingRatio: 0.2 };
          }
          // スカート：柔らかく揺れやすい
          if (/スカート|skirt/.test(name)) {
            return { mass: 2.5, stiffness: 3.0, dampingRatio: 0.15 };
          }
          // 胸：非常に柔らかく揺れる
          if (/胸|breast|bust|おっぱい|乳|mune|oppai|chest|boob/.test(name)) {
            return { mass: 3.0, stiffness: 2.5, dampingRatio: 0.2 };
          }
          // 尻尾：柔らかく揺れやすい
          if (/尻尾|tail|しっぽ/.test(name)) {
            return { mass: 2.0, stiffness: 2.5, dampingRatio: 0.2 };
          }
          // その他（リボン、袖など）：柔らかめ
          return { mass: 2.0, stiffness: 2.0, dampingRatio: 0.2 };
        };

        // ボーンとその全ての子孫を追加する関数
        const addBoneWithDescendants = (bone) => {
          if (addedBones.has(bone)) return;

          // 親の現在回転も初期化
          let parentCurrentRotation = null;
          if (bone.parent) {
            parentCurrentRotation = bone.parent.quaternion.clone();
          }

          // ボーンタイプに応じた物理パラメータ
          const params = getBonePhysicsParams(bone.name || '');

          physicsBones.push({
            bone,
            prevRotation: bone.quaternion.clone(),
            restRotation: bone.quaternion.clone(),  // アニメーションからの目標回転
            angularVelocity: new THREE.Vector3(0, 0, 0),
            parentPrevRotation: parentCurrentRotation,

            // 物理パラメータ
            mass: params.mass,
            stiffness: params.stiffness,
            dampingRatio: params.dampingRatio,
            restLength: bone.position.length()  // 親からの距離
          });
          addedBones.add(bone);
          console.log('[Simple Physics] Added bone:', bone.name, params);

          // 子ボーンも再帰的に追加
          if (bone.children) {
            bone.children.forEach(child => {
              if (child.isBone) {
                addBoneWithDescendants(child);
              }
            });
          }
        };

        mesh.skeleton.bones.forEach(bone => {
          const boneName = bone.name || '';
          const isPhysicsTarget = physicsTargetPatterns.some(pattern => pattern.test(boneName));

          if (isPhysicsTarget) {
            addBoneWithDescendants(bone);
          }
        });

        simplePhysicsBonesRef.current = physicsBones;
        simplePhysicsInitializedRef.current = true;

        console.log(`[Simple Physics] Initialized ${physicsBones.length} bones for physics simulation`);

        if (physicsBones.length === 0) {
          console.warn('[Simple Physics] No physics bones found. Bone names:', mesh.skeleton.bones.slice(0, 10).map(b => b.name));
        }

        // 衝突判定用コライダーを初期化（VRM/MMD両対応、包括的）
        const colliders = [];
        const addedColliders = new Set();

        // コライダー定義（優先度順）
        const colliderConfigs = [
          // Priority 1: 必須（髪の貫通防止）
          {
            patterns: [/^head$/i, /頭/],
            type: 'sphere',
            radius: 0.12,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 1,
            name: 'head'
          },
          {
            patterns: [/^neck$/i, /首/],
            type: 'capsule',
            radius: 0.06,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, 0.1, 0),
            priority: 1,
            name: 'neck'
          },
          {
            patterns: [/^chest$/i, /^upperChest$/i, /胸/],
            type: 'sphere',
            radius: 0.15,
            offset: new THREE.Vector3(0, 0, 0.05),
            priority: 1,
            name: 'chest'
          },
          {
            patterns: [/上半身2/],
            type: 'sphere',
            radius: 0.13,
            offset: new THREE.Vector3(0, 0, 0.03),
            priority: 1,
            name: 'upperChest'
          },

          // Priority 2: 二次（スカート等の貫通防止）
          {
            patterns: [/^spine$/i, /上半身$/],
            type: 'capsule',
            radius: 0.12,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, 0.15, 0),
            priority: 2,
            name: 'spine'
          },
          {
            patterns: [/^hips$/i, /^pelvis$/i, /下半身/],
            type: 'sphere',
            radius: 0.15,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 2,
            name: 'hips'
          },
          {
            patterns: [/腰(?!.*(上|下))/],  // 「腰」のみ（上半身、下半身を除外）
            type: 'sphere',
            radius: 0.14,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 2,
            name: 'waist'
          },
          {
            patterns: [/お尻|butt|buttock/i],
            type: 'sphere',
            radius: 0.12,
            offset: new THREE.Vector3(0, 0, -0.05),  // 後方にオフセット
            priority: 2,
            name: 'buttocks'
          },
          {
            patterns: [/グルーヴ|groove|センター|center|root/i],
            type: 'sphere',
            radius: 0.08,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 2,
            name: 'root'
          },
          {
            patterns: [/^leftUpperLeg$/i, /左足$/],
            type: 'capsule',
            radius: 0.08,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.4, 0),
            priority: 2,
            name: 'leftUpperLeg'
          },
          {
            patterns: [/^rightUpperLeg$/i, /右足$/],
            type: 'capsule',
            radius: 0.08,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.4, 0),
            priority: 2,
            name: 'rightUpperLeg'
          },
          {
            patterns: [/^leftLowerLeg$/i, /左ひざ$/],
            type: 'capsule',
            radius: 0.06,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.4, 0),
            priority: 2,
            name: 'leftLowerLeg'
          },
          {
            patterns: [/^rightLowerLeg$/i, /右ひざ$/],
            type: 'capsule',
            radius: 0.06,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.4, 0),
            priority: 2,
            name: 'rightLowerLeg'
          },
          {
            patterns: [/^leftFoot$/i, /左足首$/],
            type: 'sphere',
            radius: 0.06,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 2,
            name: 'leftFoot'
          },
          {
            patterns: [/^rightFoot$/i, /右足首$/],
            type: 'sphere',
            radius: 0.06,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 2,
            name: 'rightFoot'
          },

          // Priority 3: オプション（長い髪用）
          {
            patterns: [/^leftShoulder$/i, /左肩/],
            type: 'sphere',
            radius: 0.08,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 3,
            name: 'leftShoulder'
          },
          {
            patterns: [/^rightShoulder$/i, /右肩/],
            type: 'sphere',
            radius: 0.08,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 3,
            name: 'rightShoulder'
          },
          {
            patterns: [/^leftUpperArm$/i, /左腕$/],
            type: 'capsule',
            radius: 0.05,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.25, 0),
            priority: 3,
            name: 'leftUpperArm'
          },
          {
            patterns: [/^rightUpperArm$/i, /右腕$/],
            type: 'capsule',
            radius: 0.05,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.25, 0),
            priority: 3,
            name: 'rightUpperArm'
          },
          {
            patterns: [/^leftLowerArm$/i, /左ひじ$/],
            type: 'capsule',
            radius: 0.04,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.25, 0),
            priority: 3,
            name: 'leftLowerArm'
          },
          {
            patterns: [/^rightLowerArm$/i, /右ひじ$/],
            type: 'capsule',
            radius: 0.04,
            offset: new THREE.Vector3(0, 0, 0),
            tail: new THREE.Vector3(0, -0.25, 0),
            priority: 3,
            name: 'rightLowerArm'
          },
          {
            patterns: [/^leftHand$/i, /左手首$/],
            type: 'sphere',
            radius: 0.04,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 3,
            name: 'leftHand'
          },
          {
            patterns: [/^rightHand$/i, /右手首$/],
            type: 'sphere',
            radius: 0.04,
            offset: new THREE.Vector3(0, 0, 0),
            priority: 3,
            name: 'rightHand'
          }
        ];

        // ボーンを走査してコライダーを追加
        mesh.skeleton.bones.forEach(bone => {
          const boneName = bone.name || '';

          // 物理演算対象ボーンは除外（髪、スカート等）
          if (/髪|hair|スカート|skirt|リボン|ribbon|ポニー|twin|tail|しっぽ/i.test(boneName)) {
            return;
          }

          colliderConfigs.forEach(config => {
            // すでに追加済みのコライダー名はスキップ
            if (addedColliders.has(config.name)) {
              return;
            }

            // パターンマッチング
            const matched = config.patterns.some(pattern => pattern.test(boneName));
            if (matched) {
              const collider = {
                bone,
                type: config.type,
                radius: config.radius,
                offset: config.offset.clone(),
                priority: config.priority,
                name: config.name
              };

              if (config.type === 'capsule') {
                collider.tail = config.tail.clone();
              }

              colliders.push(collider);
              addedColliders.add(config.name);
              console.log(`[Simple Physics] Added ${config.type} collider:`, boneName, 'as', config.name, 'radius:', config.radius);
            }
          });
        });

        simplePhysicsCollidersRef.current = colliders;
        console.log(`[Simple Physics] Initialized ${colliders.length} colliders (${colliders.filter(c => c.priority === 1).length} essential, ${colliders.filter(c => c.priority === 2).length} secondary, ${colliders.filter(c => c.priority === 3).length} optional)`);
      }

      // VMDトラック削除はしない（アニメーションと物理をブレンドする）
      // 削除すると追従しなくなるため、アニメーション回転を取得して目標とする
      if (simplePhysicsInitializedRef.current && !simplePhysicsTracksRemovedRef.current) {
        console.log('[Simple Physics] VMD tracks NOT removed - will blend animation with physics');
        simplePhysicsTracksRemovedRef.current = true;
      }
    } else if (!enableSimplePhysics && simplePhysicsInitializedRef.current) {
      // 簡易物理演算がオフになったらリセット
      simplePhysicsInitializedRef.current = false;
      simplePhysicsBonesRef.current = [];
      simplePhysicsCollidersRef.current = [];
      simplePhysicsTracksRemovedRef.current = false;
      console.log('[Simple Physics] Disabled');
    }

    // GPT-5 nano表情制御（MMD用・発話内容に基づく表情生成）
    // ★コメントアウト：表情操作が不自然なため無効化
    /*
    if (isSpeaking && currentSpeechText && currentSpeechText !== mmdLastSpeechTextRef.current && mesh) {
      mmdLastSpeechTextRef.current = currentSpeechText;

      // 利用可能な表情モーフのリストを取得
      const availableExpressions = [];
      mesh.traverse((child) => {
        if (child.morphTargetDictionary && child.morphTargetInfluences) {
          Object.keys(child.morphTargetDictionary).forEach(morphName => {
            if (!availableExpressions.includes(morphName)) {
              availableExpressions.push(morphName);
            }
          });
        }
      });

      if (availableExpressions.length > 0) {
        console.log('[GPT-5 nano MMD] Available expressions:', availableExpressions);

        // GPT-5 nanoで表情パラメータを生成（非同期）
        if (aiService.isReady) {
          (async () => {
            try {
              const params = await aiService.generateExpressionParams(currentSpeechText, availableExpressions);
              if (params) {
                mmdGptExpressionParamsRef.current = params;
                console.log('[GPT-5 nano MMD] Generated expression params:', params);
              }
            } catch (error) {
              console.error('[GPT-5 nano MMD] Failed to generate expression params:', error);
            }
          })();
        }
      }
    } else if (!isSpeaking) {
      // 発話終了時にクリア
      mmdLastSpeechTextRef.current = '';
      mmdGptExpressionParamsRef.current = null;
    }
    */

    // helper.update()の直後に口パクを適用（VMDの表情を上書き）
    if (isSpeaking && mesh) {
      const lipSyncTargets = mmdLipSyncRef.current?.targets || [];

      if (lipSyncTargets.length > 0) {
        // 初期化：現在の母音とサイクル情報を保持
        if (!mmdMouthStateRef.current || typeof mmdMouthStateRef.current !== 'object') {
          mmdMouthStateRef.current = {
            currentVowel: null,
            nextCycle: 0,
            isOpen: false
          };
          console.log('[MMD LipSync] Starting lip sync, targets:', lipSyncTargets.length);
        }

        mmdMouthTimerRef.current += delta;
        const state = mmdMouthStateRef.current;

        // サイクル完了時に新しい母音をランダムに選択
        if (mmdMouthTimerRef.current >= state.nextCycle) {
          mmdMouthTimerRef.current = 0;
          state.isOpen = !state.isOpen;
          state.nextCycle = 0.08 + Math.random() * 0.08; // 0.08-0.16秒

          // 口を開く時に新しい母音を選択
          if (state.isOpen) {
            // よく使われる母音の重み付け: a(30%), i(25%), u(20%), e(15%), o(10%)
            const vowelWeights = { a: 0.3, i: 0.25, u: 0.2, e: 0.15, o: 0.1 };
            const rand = Math.random();
            let cumulative = 0;
            for (const [vowel, weight] of Object.entries(vowelWeights)) {
              cumulative += weight;
              if (rand < cumulative) {
                state.currentVowel = vowel;
                break;
              }
            }
            if (Math.random() < 0.1) {
              console.log('[MMD LipSync] Selected vowel:', state.currentVowel);
            }
          }
        }

        // イージング（ease-in-out）
        const progress = mmdMouthTimerRef.current / state.nextCycle;
        const easeProgress = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // 最小の開き具合（完全には閉じない）
        const minOpenness = 0.25;

        // 母音ごとの最大開き具合
        const vowelMaxIntensity = {
          a: 0.85 + Math.random() * 0.15,  // あ: 0.85-1.0（大きく開く）
          i: 0.55 + Math.random() * 0.25,  // い: 0.55-0.8（横に引く）
          u: 0.65 + Math.random() * 0.25,  // う: 0.65-0.9（すぼめる）
          e: 0.7 + Math.random() * 0.2,    // え: 0.7-0.9（中くらい）
          o: 0.75 + Math.random() * 0.25   // お: 0.75-1.0（丸く開く）
        };

        const maxIntensity = vowelMaxIntensity[state.currentVowel] || 0.8;

        // 開く時: minOpenness → maxIntensity
        // 閉じる時: maxIntensity → minOpenness（完全には閉じない）
        const mouthValue = state.isOpen
          ? minOpenness + easeProgress * (maxIntensity - minOpenness)
          : minOpenness + (1 - easeProgress) * (maxIntensity - minOpenness);

        lipSyncTargets.forEach((target) => {
          const { influences, vowels, vowelNames } = target;
          if (!influences || !vowels) return;

          // 全ての母音をリセット
          for (const vowel of vowelNames) {
            const morphInfo = vowels[vowel];
            if (morphInfo && typeof morphInfo.index === 'number') {
              influences[morphInfo.index] = 0;
            }
          }

          // 現在の母音を適用（isOpenに関わらず常に適用）
          if (state.currentVowel && vowels[state.currentVowel]) {
            const morphInfo = vowels[state.currentVowel];
            influences[morphInfo.index] = mouthValue;

            // 定期的にログ出力
            if (Math.random() < 0.05) {
              console.log(`[MMD LipSync] Applying ${state.currentVowel}=${mouthValue.toFixed(3)} (${morphInfo.name}) isOpen=${state.isOpen}`);
            }
          }
        });

        // GPT-5 nanoが生成した表情パラメータを適用（口パク母音以外）
        // ★コメントアウト：表情操作が不自然なため無効化
        /*
        if (mmdGptExpressionParamsRef.current) {
          const vowelMorphs = ['あ', 'い', 'う', 'え', 'お', 'a', 'i', 'u', 'e', 'o', 'ワ', 'ω'];

          lipSyncTargets.forEach((target) => {
            const mesh = target.mesh;
            if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

            Object.entries(mmdGptExpressionParamsRef.current).forEach(([expName, value]) => {
              // 母音モーフは口パクで制御しているので除外
              if (vowelMorphs.some(v => expName.includes(v))) return;

              // モーフ名の完全一致または部分一致で適用
              Object.keys(mesh.morphTargetDictionary).forEach(morphName => {
                if (morphName === expName || morphName.includes(expName) || expName.includes(morphName)) {
                  const morphIndex = mesh.morphTargetDictionary[morphName];
                  if (typeof morphIndex === 'number' && typeof value === 'number') {
                    mesh.morphTargetInfluences[morphIndex] = value;
                  }
                }
              });
            });
          });
        }
        */
      }
    } else if (!isSpeaking && mesh) {
      // isSpeaking=falseの時、口パクモーフをリセット
      const lipSyncTargets = mmdLipSyncRef.current?.targets || [];
      if (lipSyncTargets.length > 0 && mmdMouthStateRef.current) {
        lipSyncTargets.forEach((target) => {
          const { influences, vowels, vowelNames } = target;
          if (!influences || !vowels) return;

          // 全ての母音をリセット
          for (const vowel of vowelNames) {
            const morphInfo = vowels[vowel];
            if (morphInfo && typeof morphInfo.index === 'number') {
              influences[morphInfo.index] = 0;
            }
          }
        });

        // ステートもリセット
        mmdMouthStateRef.current = null;
        mmdMouthTimerRef.current = 0;
      }
    }

    if (meshObj && meshObj.physics && meshObj.physics.bodies) {
      const maxLinearVelocity = 5.0;  // 0.8 → 5.0 m/s（激しい動きに追従できるように）
      const maxAngularVelocity = 3.0;  // 0.5 → 3.0 rad/s

      meshObj.physics.bodies.forEach((bodyWrapper) => {
        const body = bodyWrapper?.body || bodyWrapper;
        if (!body || typeof body.getLinearVelocity !== 'function') return;

        // ★pendingResetType === 'loop'時の速度リセットを削除（滑らかなループのため）
        // 速度制限のみ行う

        const linearVel = body.getLinearVelocity();
        const linearSpeed = Math.sqrt(
          linearVel.x() * linearVel.x() +
          linearVel.y() * linearVel.y() +
          linearVel.z() * linearVel.z()
        );
        if (linearSpeed > maxLinearVelocity) {
          const scale = maxLinearVelocity / linearSpeed;
          const clampedVel = new window.Ammo.btVector3(
            linearVel.x() * scale,
            linearVel.y() * scale,
            linearVel.z() * scale
          );
          body.setLinearVelocity(clampedVel);
          window.Ammo.destroy(clampedVel);
        }

        const angularVel = body.getAngularVelocity();
        const angularSpeed = Math.sqrt(
          angularVel.x() * angularVel.x() +
          angularVel.y() * angularVel.y() +
          angularVel.z() * angularVel.z()
        );
        if (angularSpeed > maxAngularVelocity) {
          const scale = maxAngularVelocity / angularSpeed;
          const clampedVel = new window.Ammo.btVector3(
            angularVel.x() * scale,
            angularVel.y() * scale,
            angularVel.z() * scale
          );
          body.setAngularVelocity(clampedVel);
          window.Ammo.destroy(clampedVel);
        }
      });
    }

    if (meshObj && meshObj.mixer && meshObj.mixer._actions.length > 0) {
      const action = meshObj.mixer._actions[0];
      const clip = action._clip;

      if (clip && clip.duration > 0) {
        const currentTime = action.time;
        const duration = clip.duration;
        const counter = loopCounterRef.current;

        if (Math.random() < 0.01) {
          console.log(`[MMDModel] Frame debug: time=${currentTime.toFixed(2)}, lastTime=${counter.lastTime.toFixed(2)}, loops=${counter.currentLoops}, target=${counter.targetLoops}`);
        }

        // ★ループ前の物理演算リセットを削除（滑らかなループのため）
        // モーション切り替え時のリセットはapplyAnimationClipで行われる
        if (duration > 0 && currentTime > duration - 0.15 && currentTime < duration) {
          // 何もしない（物理演算を継続）
          if (!counter.preLoopReset) {
            console.log(`[MMD Physics] Approaching loop end - keeping physics state for smooth loop`);
            counter.preLoopReset = true;
          }
        } else if (currentTime < duration - 0.2) {
          counter.preLoopReset = false;
        }

        if (counter.lastTime > 0 && currentTime < counter.lastTime) {
          counter.currentLoops += 1;
          console.log(`[MMDModel] Loop completed: ${counter.currentLoops}/${counter.targetLoops}`);

          const reachedTarget = counter.currentLoops >= counter.targetLoops;
          const pendingType = reachedTarget ? 'target' : 'loop';
          if (mesh?.userData) {
            mesh.userData.pendingResetType = pendingType;
          }

          // ★ループ完了時の物理演算リセットを削除（滑らかなループのため）
          // モーション切り替え時のリセットはapplyAnimationClipで行われる
          console.log(`[MMD Physics] Loop completed - keeping physics state for smooth continuation`);
          // else if (initialBonesStateRef.current && mesh.skeleton && mesh.skeleton.bones) {
          //   // 軽量リセット: ボーンのみリセット（mesh入れ替えなし）
          //   mesh.skeleton.bones.forEach((bone, index) => {
          //     const savedState = initialBonesStateRef.current[index];
          //     if (!savedState) return;
          //     bone.position.copy(savedState.position);
          //     bone.quaternion.copy(savedState.quaternion);
          //     bone.scale.copy(savedState.scale);
          //     bone.matrixAutoUpdate = true;
          //     bone.matrixWorldNeedsUpdate = true;
          //   });
          //   mesh.skeleton.update();
          //   mesh.updateMatrixWorld(true);
          // }
          // else { resetMeshToInitialState(); } // 削除：Tポーズにリセットしない

          if (onLoopCompleteRef.current) {
            onLoopCompleteRef.current(reachedTarget);
          }

          if (reachedTarget) {
            counter.currentLoops = 0;
            counter.lastTime = -1;
            counter.preLoopReset = false;
            return;
          }

          counter.preLoopReset = false;
          counter.lastTime = 0;
          return;
        }

        counter.lastTime = currentTime;
      }
    }

    // カメラ追従機能
    if (enableCameraFollow && onCameraChange && meshRef.current && cameraConfig) {
      const modelPosition = meshRef.current.position;
      const currentLookAt = cameraConfig.lookAt || [0, 1, 0];
      const targetLookAt = [
        modelPosition.x,
        modelPosition.y + 1.0,
        modelPosition.z
      ];

      const followSpeed = 0.05;
      const newLookAt = [
        currentLookAt[0] + (targetLookAt[0] - currentLookAt[0]) * followSpeed,
        currentLookAt[1] + (targetLookAt[1] - currentLookAt[1]) * followSpeed,
        currentLookAt[2] + (targetLookAt[2] - currentLookAt[2]) * followSpeed
      ];

      const currentPos = cameraConfig.position || [0, 1.4, 2.5];
      const offsetX = currentPos[0] - currentLookAt[0];
      const offsetY = currentPos[1] - currentLookAt[1];
      const offsetZ = currentPos[2] - currentLookAt[2];

      const newPosition = [
        newLookAt[0] + offsetX,
        newLookAt[1] + offsetY,
        newLookAt[2] + offsetZ
      ];

      onCameraChange({
        position: newPosition,
        lookAt: newLookAt,
        fov: cameraConfig.fov || 50
      });
    }
  });

  return null;
}

// メインビューアコンポーネント
const VRMViewer = forwardRef(({ modelUrl, modelType = 'auto', onMotionReady, enableMouseFollow = true, enableInteraction = true, emotion = 'neutral', emotionIntensity = 0.5, isTyping = false, gesture = null, isSpeaking = false, currentSpeechText = '', cameraConfig = { position: [0, 1.4, 2.5], fov: 50, lookAt: [0,1,0] }, manualCamera = true, onCameraChange, mmdFileMap, mmdVmdUrls = [], mmdTapMotionUrls = [], mmdPetMotionUrls = [], onMmdAnimationDuration, onInteraction, onMmdInteractionMotion, enableCameraFollow = false, enableManualCamera = true, mmdTargetLoopCount = 3, onMmdLoopComplete, overlayBlendRatio = 1.0, enablePhysics = true, enablePmxAnimation = false, enableSimplePhysics = false, mmdScale = 0.09, vrmScale = 1.0, mmdShininess = 50, mmdBrightness = 1.0, parentClonedMeshRef, aiStatus = 'not-initialized' }, ref) => {
  // console.log('[VRMViewer] Render', { modelType, mmdVmdUrls });

  const [type, setType] = useState(modelType);
  const mmdMeshRef = useRef(null);
  const mmdInitialBonesRef = useRef(null);
  const mmdHelperRef = useRef(null);
  const mmdSceneRef = useRef(null);
  const mmdClonedMeshRef = parentClonedMeshRef || useRef(null);
  const [tapEffects, setTapEffects] = useState([]);
  const enablePhysicsRef = useRef(enablePhysics);

  // enablePhysicsの変更を追跡
  useEffect(() => {
    enablePhysicsRef.current = enablePhysics;
  }, [enablePhysics]);

  // タップエフェクトを追加
  const handleTapEffect = (x, y) => {
    const effectId = Date.now();
    setTapEffects(prev => [...prev, { id: effectId, x, y }]);

    // 0.6秒後にエフェクトを削除
    setTimeout(() => {
      setTapEffects(prev => prev.filter(e => e.id !== effectId));
    }, 600);
  };

  // modelType prop が vrm / mmd のときはそれを優先
  useEffect(() => {
    if (modelType === 'vrm' || modelType === 'mmd') {
      setType(modelType);
    }
  }, [modelType]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (modelType === 'auto') {
      // 拡張子から自動判定
      const ext = modelUrl?.split('.').pop()?.toLowerCase();
      if (ext === 'vrm') {
        setType('vrm');
      } else if (ext === 'pmx' || ext === 'pmd') {
        setType('mmd');
      }
    }
  }, [modelUrl, modelType]);

  const handleModelLoad = (model) => {
    setIsLoaded(true);
    console.log('Model loaded:', model);
  };

  const mmdMeshRefSetter = useRef(null);

  const handleMmdMeshReady = (mesh, initialBones, setMeshRef) => {
    mmdMeshRef.current = mesh;
    mmdInitialBonesRef.current = initialBones;
    mmdMeshRefSetter.current = setMeshRef; // MMDModel内のmeshRefを更新する関数を保存
    console.log('[VRMViewer] MMD mesh ready for bone reset');
  };

  // ボーンリセット機能を外部に公開（MMD初期化）
  useImperativeHandle(ref, () => ({
    resetBones: async () => {
      const mesh = mmdMeshRef.current;
      const clonedMesh = mmdClonedMeshRef.current;
      const helper = mmdHelperRef.current;
      const scene = mmdSceneRef.current;

      if (!mesh || !mesh.skeleton) {
        console.warn('[VRMViewer] No MMD mesh or skeleton to reset');
        return;
      }

      if (!clonedMesh) {
        console.warn('[VRMViewer] No cloned mesh available for reset');
        console.warn('[VRMViewer] mmdClonedMeshRef.current:', mmdClonedMeshRef.current);
        return;
      }

      console.log('[VRMViewer] Resetting MMD using cloned mesh...');
      console.log('[VRMViewer] Cloned mesh type:', clonedMesh?.type, 'has skeleton:', !!clonedMesh?.skeleton);
      console.log('[VRMViewer] Cloned mesh bones count:', clonedMesh?.skeleton?.bones?.length);

      const pendingResetType = mesh.userData?.pendingResetType || null;
      if (mesh.userData) {
        mesh.userData.pendingResetType = null;
      }

      // 現在の mesh を helper と scene から削除
      if (helper && helper.objects) {
        try {
          helper.remove(mesh);
        } catch (removeErr) {
          console.warn('[VRMViewer] Failed to remove mesh from helper:', removeErr);
        }
      }

      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      if (scene) {
        scene.remove(mesh);
      }

      // clone から新しい mesh を作成（SkeletonUtils でボーンを含めて完全コピー）
      console.log('[VRMViewer] Creating new mesh from clonedMesh...');
      console.time('[VRMViewer] SkeletonUtils.clone');
      const newMesh = SkeletonUtils.clone(clonedMesh);
      console.timeEnd('[VRMViewer] SkeletonUtils.clone');
      console.log('[VRMViewer] New mesh created, type:', newMesh?.type, 'bones:', newMesh?.skeleton?.bones?.length);

      // ボーンが独立しているか確認（参照が異なるはず）
      if (clonedMesh?.skeleton?.bones?.[0] && newMesh?.skeleton?.bones?.[0]) {
        const isSameBone = clonedMesh.skeleton.bones[0] === newMesh.skeleton.bones[0];
        console.log('[VRMViewer] First bone same reference?:', isSameBone, '(should be false)');
      }

      // 新しい mesh を scene に追加
      if (scene) {
        scene.add(newMesh);
      }

      // loopCounterRef を新しいメッシュに設定（ループ数は保存）
      const loopCounterHolder = mesh.userData?.loopCounterRef;
      const previousLoops = loopCounterHolder?.current?.currentLoops ?? 0;
      if (loopCounterHolder) {
        newMesh.userData = newMesh.userData || {};
        newMesh.userData.loopCounterRef = loopCounterHolder;
        // ループカウントは保持（リセット後に+1される）
        loopCounterHolder.current.currentLoops = previousLoops;
        loopCounterHolder.current.lastTime = -1;
        loopCounterHolder.current.preLoopReset = false;
        console.log(`[VRMViewer] Loop counter attached to new mesh (preserving loops: ${previousLoops})`);
      }

      // 古いmeshのuserDataを引き継ぐ
      newMesh.userData.initializeMmdLipSyncTargets = mesh.userData?.initializeMmdLipSyncTargets;

      // ★重要：マテリアル情報を再収集（クローンされたmeshから直接取得）
      console.time('[VRMViewer] Collect originalMaterials');
      const newOriginalMaterials = [];
      newMesh.traverse((child) => {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              newOriginalMaterials.push({
                material: mat,
                originalColor: mat.color ? mat.color.clone() : null
              });
            });
          } else {
            newOriginalMaterials.push({
              material: child.material,
              originalColor: child.material.color ? child.material.color.clone() : null
            });
          }
        }
      });
      newMesh.userData.originalMaterials = newOriginalMaterials;
      console.timeEnd('[VRMViewer] Collect originalMaterials');
      console.log('[VRMViewer] Collected originalMaterials from newMesh:', newOriginalMaterials.length);

      // マテリアル更新をトリガー（userDataにフラグを立てる）
      newMesh.userData.materialUpdateNeeded = true;

      // 現在のモーションを保存
      const currentClip = mesh.userData?.currentMmdClip;
      console.log('[VRMViewer] Current clip from userData:', currentClip?.name, 'duration:', currentClip?.duration);

      // 新しい mesh を ref に保存（helper.addの前に設定）
      mmdMeshRef.current = newMesh;

      // MMDModel内のmeshRef.currentも更新（useFrameで正しいmeshを参照するため）
      if (mmdMeshRefSetter.current) {
        mmdMeshRefSetter.current(newMesh);
      } else {
        console.warn('[VRMViewer] mmdMeshRefSetter not available - MMDModel meshRef not updated');
      }

      // 新しいmeshをMMDModelのmeshRefとして認識させるため、userDataを設定
      newMesh.userData = newMesh.userData || {};
      newMesh.userData.loopCounterRef = loopCounterHolder;
      // currentMmdClipはクリア（新しいモーションがすぐに適用される）
      newMesh.userData.currentMmdClip = null;

      // ★重要：クローン再構築時はhelper.add()を呼ばず、空の状態にする
      // 次のモーション切り替えで新しいモーションが適用される
      console.log('[VRMViewer] Cloned mesh added to scene (no animation, waiting for next motion)');

      const run = (physicsOverride) => {
        // 空の状態を維持（helper.add()を呼ばない）
        // 次のモーション適用時にapplyAnimationClipが呼ばれてhelper.add()される
        console.log('[VRMViewer] Keeping mesh in empty state for next motion');

        // ループカウンターだけリセットして終了
        const counter = loopCounterHolder?.current;
        if (counter) {
          counter.lastTime = -1;
          counter.preLoopReset = false;
          console.log(`[VRMViewer] Reset complete (empty state), current loops: ${counter.currentLoops}/${counter.targetLoops}`);
        }

        newMesh.userData.reinitializeMmdAnimation = run;
        newMesh.userData.resetMmdPose = mesh.userData?.resetMmdPose;

        // 空の状態なので早期終了
        return null;

        /* 以下、将来的に必要になった場合のために残しておく（コメントアウト）
          const actions = mixer._actions ? [...mixer._actions] : [];
          actions.forEach((action) => {
            // アクションの時間を明示的に0にリセット
            action.time = 0;
            action.reset();
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.enabled = true;
            action.paused = false;
          });

          // ★重要：IKソルバーはmixer設定後、play()前にリセット
          if (meshObj?.ikSolver && typeof meshObj.ikSolver.reset === 'function') {
            try {
              meshObj.ikSolver.reset();
              console.log('[VRMViewer] IK solver reset after mixer setup');

              // IKソルバーを初期フレーム（time=0）で更新
              if (typeof meshObj.ikSolver.update === 'function') {
                meshObj.ikSolver.update();
                console.log('[VRMViewer] IK solver updated to initial frame');
              }
            } catch (ikError) {
              console.warn('[VRMViewer] Failed to reset/update IK solver:', ikError);
            }
          }

          // IKソルバーリセット後、アニメーション再生開始
          actions.forEach((action) => {
            action.play();
          });
          console.log(`[VRMViewer] Started ${actions.length} animation actions${wantsPhysics ? '' : ' (without physics)'}`);
        }

        if (meshObj?.physics && meshObj.physics.world) {
          const world = meshObj.physics.world;
          const solverInfo = world.getSolverInfo();
          if (typeof solverInfo.set_m_numIterations === 'function') {
            solverInfo.set_m_numIterations(wantsPhysics ? 3 : 1);
          }
          if (typeof solverInfo.set_m_numSubSteps === 'function') {
            solverInfo.set_m_numSubSteps(wantsPhysics ? 1 : 0);
          }
          const gravity = new window.Ammo.btVector3(0, wantsPhysics ? -5.0 : -9.8, 0);
          world.setGravity(gravity);
          window.Ammo.destroy(gravity);

          if (Array.isArray(meshObj.physics.bodies)) {
            const zero = new window.Ammo.btVector3(0, 0, 0);
            meshObj.physics.bodies.forEach((bodyWrapper) => {
              const body = bodyWrapper?.body || bodyWrapper;
              if (!body) return;
              if (typeof body.setDamping === 'function') {
                body.setDamping(wantsPhysics ? 0.7 : 0.95, wantsPhysics ? 0.8 : 0.95);
              }
              if (typeof body.setLinearVelocity === 'function') {
                body.setLinearVelocity(zero);
                body.setAngularVelocity(zero);
              }
              if (typeof body.activate === 'function') {
                body.activate(true);
              }
            });
            window.Ammo.destroy(zero);
            console.log(`[VRMViewer] Reset ${meshObj.physics.bodies.length} rigid bodies`);
          }
        }

        // ループカウンターの状態をリセット（currentLoopsは保持）
        const counter = loopCounterHolder?.current;
        if (counter) {
          // currentLoopsはそのまま（ループ完了時に既に+1されている）
          counter.lastTime = -1;
          counter.preLoopReset = false;
          console.log(`[VRMViewer] Reset complete, current loops: ${counter.currentLoops}/${counter.targetLoops}`);
        }

        newMesh.userData.reinitializeMmdAnimation = run;
        newMesh.userData.resetMmdPose = mesh.userData?.resetMmdPose;
        // currentMmdClipはnull（空の状態を維持）

        // ★物理演算の初期状態を保存（applyAnimationClipと同じ処理）
        if (meshObj?.physics && Array.isArray(meshObj.physics.bodies) && window.Ammo) {
          console.log('[VRMViewer] Storing initial physics state for new mesh...');
          const initialStates = meshObj.physics.bodies.map((wrapper) => {
            const body = wrapper?.body || wrapper;
            if (!body || typeof body.getMotionState !== 'function') {
              return null;
            }

            const transform = new window.Ammo.btTransform();
            body.getMotionState().getWorldTransform(transform);
            const origin = transform.getOrigin();
            const rotation = transform.getRotation();

            const record = {
              position: [origin.x(), origin.y(), origin.z()],
              quaternion: [rotation.x(), rotation.y(), rotation.z(), rotation.w()]
            };

            window.Ammo.destroy(transform);
            return record;
          });

          newMesh.userData.initialPhysicsState = initialStates;
          console.log(`[VRMViewer] Stored initial physics state for ${initialStates.length} bodies`);
        }

        // リップシンク初期化は既にnewMesh.userDataに設定されているものを使用
        if (newMesh.userData.initializeMmdLipSyncTargets) {
          newMesh.userData.initializeMmdLipSyncTargets();
        }

        return meshObj;
        */
      };

      // 初回実行（初期ロードのapplyAnimationClipと同じ）
      run();

      console.log('[VRMViewer] MMD clone reset complete - mesh replaced');
    }
  }), [mmdFileMap]);

  if (!modelUrl) {
    return (
      <div className="viewer-placeholder">
        <p>モデルファイルを選択してください</p>
        <p>.vrm, .pmx, .pmd対応</p>
      </div>
    );
  }

  return (
    <div className="vrm-viewer" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: cameraConfig?.position || [0,1.4,2.5], fov: cameraConfig?.fov || 50 }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <CameraConfigApplier cameraConfig={cameraConfig} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[1, 1, 1]} intensity={0.7} />
        <pointLight position={[-1, 1, -1]} intensity={0.5} />
        
        {type === 'vrm' ? (
          <VRMModel
            url={modelUrl}
            onLoad={handleModelLoad}
            onMotionReady={onMotionReady}
            enableMouseFollow={enableMouseFollow}
            enableInteraction={enableInteraction}
            emotion={emotion}
            emotionIntensity={emotionIntensity}
            isTyping={isTyping}
            gesture={gesture}
            isSpeaking={isSpeaking}
            currentSpeechText={currentSpeechText}
            cameraConfig={cameraConfig}
            onInteraction={onInteraction}
            enableCameraFollow={enableCameraFollow}
            onCameraChange={onCameraChange}
            overlayBlendRatio={overlayBlendRatio}
            onTapEffect={handleTapEffect}
            vrmScale={vrmScale}
          />
        ) : type === 'mmd' ? (
          <MMDModel
            url={modelUrl}
            onLoad={handleModelLoad}
            fileMap={mmdFileMap}
            vmdUrls={mmdVmdUrls}
            onAnimationDuration={onMmdAnimationDuration}
            onMeshReady={handleMmdMeshReady}
            onInteraction={onInteraction}
            tapMotionUrls={mmdTapMotionUrls}
            petMotionUrls={mmdPetMotionUrls}
            onMmdInteractionMotion={onMmdInteractionMotion}
            helperRef={mmdHelperRef}
            sceneRef={mmdSceneRef}
            clonedMeshRef={mmdClonedMeshRef}
            enableCameraFollow={enableCameraFollow}
            onCameraChange={onCameraChange}
            cameraConfig={cameraConfig}
            targetLoopCount={mmdTargetLoopCount}
            onLoopComplete={onMmdLoopComplete}
            enablePhysicsRef={enablePhysicsRef}
            enablePhysics={enablePhysics}
            enablePmxAnimation={enablePmxAnimation}
            enableSimplePhysics={enableSimplePhysics}
            isSpeaking={isSpeaking}
            currentSpeechText={currentSpeechText}
            onTapEffect={handleTapEffect}
            mmdScale={mmdScale}
            mmdShininess={mmdShininess}
            mmdBrightness={mmdBrightness}
          />
        ) : type === 'unsupported' ? (
          <group>
            <mesh>
              <boxGeometry args={[1,1,1]} />
              <meshStandardMaterial color="orange" />
            </mesh>
          </group>
        ) : null}
        
        <Environment preset="sunset" background={false} />
      </Canvas>

      {!isLoaded && (
        <div className="loading-indicator">
          <p>読み込み中...</p>
        </div>
      )}
      {manualCamera && enableManualCamera && (
        <CameraInteractionOverlay cameraConfig={cameraConfig} onCameraChange={onCameraChange} />
      )}

      {/* タップエフェクト */}
      {tapEffects.map(effect => (
        <div key={effect.id} style={{
          position: 'absolute',
          left: effect.x,
          top: effect.y,
          pointerEvents: 'none',
          zIndex: 9999
        }}>
          {/* 外側の円 */}
          <div style={{
            position: 'absolute',
            width: '60px',
            height: '60px',
            marginLeft: '-30px',
            marginTop: '-30px',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
            animation: 'tapRipple 0.6s ease-out forwards'
          }} />
          {/* 内側の円 */}
          <div style={{
            position: 'absolute',
            width: '40px',
            height: '40px',
            marginLeft: '-20px',
            marginTop: '-20px',
            border: '2px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '50%',
            animation: 'tapRipple 0.6s ease-out 0.1s forwards'
          }} />
        </div>
      ))}
    </div>
  );
});

export default VRMViewer;
