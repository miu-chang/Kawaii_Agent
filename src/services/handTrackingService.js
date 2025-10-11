import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

/**
 * MediaPipe Hands統合サービス（実験機能）
 * スマホカメラから手を検出してAR/MR空間にマッピング
 */
class HandTrackingService {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.isTracking = false;
    this.onHandDetected = null;
    this.lastHandData = null;
    this.enabled = false;
  }

  /**
   * 手検出を初期化
   * @param {HTMLVideoElement} videoElement - カメラ映像用video要素
   * @param {HTMLCanvasElement} canvasElement - 描画用canvas（デバッグ表示）
   * @param {Function} onHandDetected - 手検出時のコールバック
   */
  async initialize(videoElement, canvasElement, onHandDetected) {
    try {
      console.log('[HandTracking] Initializing MediaPipe Hands...');

      this.videoElement = videoElement;
      this.canvasElement = canvasElement;
      this.onHandDetected = onHandDetected;

      // MediaPipe Hands初期化
      this.hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 2,              // 両手検出
        modelComplexity: 1,          // 0=軽量, 1=標準
        minDetectionConfidence: 0.5, // 検出信頼度
        minTrackingConfidence: 0.5   // トラッキング信頼度
      });

      // 結果受信コールバック
      this.hands.onResults((results) => this.onResults(results));

      // カメラ初期化
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.isTracking && this.hands) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: 1280,
        height: 720
      });

      this.enabled = true;
      console.log('[HandTracking] MediaPipe Hands initialized');

    } catch (error) {
      console.error('[HandTracking] Initialization failed:', error);
      this.enabled = false;
    }
  }

  /**
   * 手検出開始
   */
  async start() {
    if (!this.enabled || !this.camera) {
      console.warn('[HandTracking] Not initialized or not enabled');
      return false;
    }

    try {
      this.isTracking = true;
      await this.camera.start();
      console.log('[HandTracking] Hand tracking started');
      return true;
    } catch (error) {
      console.error('[HandTracking] Failed to start:', error);
      this.isTracking = false;
      return false;
    }
  }

  /**
   * 手検出停止
   */
  stop() {
    if (this.camera) {
      this.camera.stop();
    }
    this.isTracking = false;
    console.log('[HandTracking] Hand tracking stopped');
  }

  /**
   * 手検出結果を処理
   */
  onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.lastHandData = null;
      return;
    }

    // デバッグ描画
    if (this.canvasElement) {
      const ctx = this.canvasElement.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

      // 手のランドマーク描画
      for (const landmarks of results.multiHandLandmarks) {
        this.drawHand(ctx, landmarks);
      }

      ctx.restore();
    }

    // 手データを変換
    const handsData = results.multiHandLandmarks.map((landmarks, index) => {
      const handedness = results.multiHandedness[index]?.label || 'Unknown';

      // 重要なランドマーク
      const indexTip = landmarks[8];   // 人差し指先端
      const thumbTip = landmarks[4];   // 親指先端
      const wrist = landmarks[0];      // 手首
      const palm = landmarks[9];       // 手のひら中心

      // ピンチ検出（親指と人差し指の距離）
      const pinchDistance = Math.sqrt(
        Math.pow(indexTip.x - thumbTip.x, 2) +
        Math.pow(indexTip.y - thumbTip.y, 2) +
        Math.pow(indexTip.z - thumbTip.z, 2)
      );
      const isPinching = pinchDistance < 0.05;

      // ========================================
      // 拡張ジェスチャー認識
      // ========================================

      // 握った手検出（全指を曲げている）
      const fingerTips = [
        landmarks[4],  // 親指
        landmarks[8],  // 人差し指
        landmarks[12], // 中指
        landmarks[16], // 薬指
        landmarks[20]  // 小指
      ];
      const fingerBases = [
        landmarks[2],  // 親指付け根
        landmarks[5],  // 人差し指付け根
        landmarks[9],  // 中指付け根
        landmarks[13], // 薬指付け根
        landmarks[17]  // 小指付け根
      ];

      // 各指が曲がっているか（先端が付け根より手のひらに近い）
      let closedFingers = 0;
      for (let i = 0; i < 5; i++) {
        const tipDist = Math.sqrt(
          Math.pow(fingerTips[i].x - palm.x, 2) +
          Math.pow(fingerTips[i].y - palm.y, 2) +
          Math.pow(fingerTips[i].z - palm.z, 2)
        );
        const baseDist = Math.sqrt(
          Math.pow(fingerBases[i].x - palm.x, 2) +
          Math.pow(fingerBases[i].y - palm.y, 2) +
          Math.pow(fingerBases[i].z - palm.z, 2)
        );
        if (tipDist < baseDist * 0.8) {
          closedFingers++;
        }
      }
      const isFist = closedFingers >= 4; // 4本以上閉じている = 握った手

      // 開いた手検出（全指が伸びている）
      let openFingers = 0;
      for (let i = 0; i < 5; i++) {
        const tipDist = Math.sqrt(
          Math.pow(fingerTips[i].x - palm.x, 2) +
          Math.pow(fingerTips[i].y - palm.y, 2) +
          Math.pow(fingerTips[i].z - palm.z, 2)
        );
        const baseDist = Math.sqrt(
          Math.pow(fingerBases[i].x - palm.x, 2) +
          Math.pow(fingerBases[i].y - palm.y, 2) +
          Math.pow(fingerBases[i].z - palm.z, 2)
        );
        if (tipDist > baseDist * 1.2) {
          openFingers++;
        }
      }
      const isOpenHand = openFingers >= 4; // 4本以上開いている = 開いた手

      // 手を振る検出（手首の速度）
      const velocity = { x: 0, y: 0, z: 0 };
      if (this.lastWristPos && this.lastWristPos[handedness]) {
        const lastPos = this.lastWristPos[handedness];
        velocity.x = (wrist.x - lastPos.x) * 30; // フレームレート30fps想定
        velocity.y = (wrist.y - lastPos.y) * 30;
        velocity.z = (wrist.z - lastPos.z) * 30;
      }
      if (!this.lastWristPos) this.lastWristPos = {};
      this.lastWristPos[handedness] = { x: wrist.x, y: wrist.y, z: wrist.z };

      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
      const isWaving = speed > 0.5 && isOpenHand; // 速く動いている + 開いた手 = 振っている

      return {
        handedness,        // 'Left' or 'Right'
        landmarks,         // 全21個のランドマーク
        indexTip,          // 人差し指先端
        thumbTip,          // 親指先端
        wrist,             // 手首
        palm,              // 手のひら中心
        isPinching,        // ピンチ中
        pinchDistance,     // ピンチ距離
        isFist,            // 握った手
        isOpenHand,        // 開いた手
        isWaving,          // 手を振っている
        velocity,          // 手首の速度
        closedFingers,     // 閉じている指の数
        openFingers        // 開いている指の数
      };
    });

    this.lastHandData = handsData;

    // コールバック呼び出し
    if (this.onHandDetected) {
      this.onHandDetected(handsData);
    }
  }

  /**
   * 手を描画（デバッグ用）
   */
  drawHand(ctx, landmarks) {
    // 接続線
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // 親指
      [0, 5], [5, 6], [6, 7], [7, 8],       // 人差し指
      [0, 9], [9, 10], [10, 11], [11, 12],  // 中指
      [0, 13], [13, 14], [14, 15], [15, 16],// 薬指
      [0, 17], [17, 18], [18, 19], [19, 20] // 小指
    ];

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    for (const [start, end] of connections) {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      ctx.beginPath();
      ctx.moveTo(startPoint.x * this.canvasElement.width, startPoint.y * this.canvasElement.height);
      ctx.lineTo(endPoint.x * this.canvasElement.width, endPoint.y * this.canvasElement.height);
      ctx.stroke();
    }

    // ランドマーク点
    ctx.fillStyle = '#ff0000';
    for (const landmark of landmarks) {
      ctx.beginPath();
      ctx.arc(
        landmark.x * this.canvasElement.width,
        landmark.y * this.canvasElement.height,
        5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }

  /**
   * 2D座標（カメラ画像）を3D AR座標に変換
   * @param {Object} handData - 手データ
   * @param {Object} camera - Three.jsカメラ
   * @param {number} targetDepth - 配置する深度（メートル）
   */
  convertToARCoordinates(handData, camera, targetDepth = 1.0) {
    if (!handData || !camera) return null;

    // 人差し指先端を使用
    const { indexTip } = handData;

    // 正規化デバイス座標（NDC）に変換
    // MediaPipe座標系: (0,0)=左上, (1,1)=右下
    // NDC: (-1,1)=左上, (1,-1)=右下
    const ndcX = indexTip.x * 2 - 1;
    const ndcY = -(indexTip.y * 2 - 1);

    // カメラパラメータ取得
    const aspect = camera.aspect;
    const fov = (camera.fov * Math.PI) / 180;
    const halfHeight = Math.tan(fov / 2) * targetDepth;
    const halfWidth = halfHeight * aspect;

    // 3D座標計算
    const worldX = ndcX * halfWidth;
    const worldY = ndcY * halfHeight;
    const worldZ = -targetDepth;

    return {
      x: worldX,
      y: worldY,
      z: worldZ,
      isPinching: handData.isPinching
    };
  }

  /**
   * 最新の手データ取得
   */
  getLastHandData() {
    return this.lastHandData;
  }

  /**
   * 有効/無効切り替え
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.isTracking) {
      this.stop();
    }
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.stop();
    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }
    this.camera = null;
    this.videoElement = null;
    this.canvasElement = null;
    console.log('[HandTracking] Destroyed');
  }
}

// シングルトン
const handTrackingService = new HandTrackingService();
export default handTrackingService;
