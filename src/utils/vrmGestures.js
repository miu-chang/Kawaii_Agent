// VRMモデルのジェスチャーアニメーションシステム

export class GestureManager {
  constructor(vrm) {
    this.vrm = vrm;
    this.currentGesture = null;
    this.gestureProgress = 0;
    this.gestureDuration = 0;
    this.gestureKeyframes = [];
    this.isPlaying = false;
    this.originalRotations = new Map();
  }

  // ボーンの初期回転を保存
  saveOriginalRotations(boneNames) {
    boneNames.forEach(boneName => {
      const bone = this.vrm.humanoid?.getRawBoneNode(boneName);
      if (bone && !this.originalRotations.has(boneName)) {
        this.originalRotations.set(boneName, {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z
        });
      }
    });
  }

  // ボーンを初期位置に戻す
  resetBone(boneName) {
    const bone = this.vrm.humanoid?.getRawBoneNode(boneName);
    const original = this.originalRotations.get(boneName);
    if (bone && original) {
      bone.rotation.x = original.x;
      bone.rotation.y = original.y;
      bone.rotation.z = original.z;
    }
  }

  // 手を振るジェスチャー
  wave() {
    const keyframes = [
      { time: 0, bones: { rightUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0 }, rightHand: { z: 0 } } },
      { time: 0.3, bones: { rightUpperArm: { z: -1.5, x: 0.3 }, rightLowerArm: { z: -0.5 }, rightHand: { z: 0 } } },
      { time: 0.5, bones: { rightUpperArm: { z: -1.5, x: 0.3 }, rightLowerArm: { z: -1.2 }, rightHand: { z: 0.3 } } },
      { time: 0.7, bones: { rightUpperArm: { z: -1.5, x: 0.3 }, rightLowerArm: { z: -1.2 }, rightHand: { z: -0.3 } } },
      { time: 0.9, bones: { rightUpperArm: { z: -1.5, x: 0.3 }, rightLowerArm: { z: -1.2 }, rightHand: { z: 0.3 } } },
      { time: 1.1, bones: { rightUpperArm: { z: -1.5, x: 0.3 }, rightLowerArm: { z: -1.2 }, rightHand: { z: -0.3 } } },
      { time: 1.3, bones: { rightUpperArm: { z: -1.5, x: 0.3 }, rightLowerArm: { z: -1.2 }, rightHand: { z: 0 } } },
      { time: 1.6, bones: { rightUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0 }, rightHand: { z: 0 } } },
    ];

    this.playGesture(keyframes, 1.8);
  }

  // うなずくジェスチャー
  nod() {
    const keyframes = [
      { time: 0, bones: { head: { x: 0 }, neck: { x: 0 } } },
      { time: 0.3, bones: { head: { x: 0.3 }, neck: { x: 0.15 } } },
      { time: 0.5, bones: { head: { x: -0.1 }, neck: { x: -0.05 } } },
      { time: 0.8, bones: { head: { x: 0.3 }, neck: { x: 0.15 } } },
      { time: 1.0, bones: { head: { x: 0 }, neck: { x: 0 } } },
    ];

    this.playGesture(keyframes, 1.2);
  }

  // 考えるポーズ（手を顎に）
  thinking() {
    const keyframes = [
      { time: 0, bones: { rightUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0, x: 0 }, rightHand: { z: 0 }, head: { x: 0 } } },
      { time: 0.5, bones: { rightUpperArm: { z: -1.0, x: -0.5 }, rightLowerArm: { z: -1.8, x: 0 }, rightHand: { z: 0.2 }, head: { x: 0.2 } } },
      { time: 2.5, bones: { rightUpperArm: { z: -1.0, x: -0.5 }, rightLowerArm: { z: -1.8, x: 0 }, rightHand: { z: 0.2 }, head: { x: 0.2 } } },
      { time: 3.0, bones: { rightUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0, x: 0 }, rightHand: { z: 0 }, head: { x: 0 } } },
    ];

    this.playGesture(keyframes, 3.2);
  }

  // 喜びのポーズ（両手を上げる）
  joy() {
    const keyframes = [
      { time: 0, bones: { rightUpperArm: { z: 0, x: 0 }, leftUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0 }, leftLowerArm: { z: 0 } } },
      { time: 0.3, bones: { rightUpperArm: { z: -1.2, x: -0.3 }, leftUpperArm: { z: 1.2, x: -0.3 }, rightLowerArm: { z: -0.8 }, leftLowerArm: { z: 0.8 } } },
      { time: 1.0, bones: { rightUpperArm: { z: -1.2, x: -0.3 }, leftUpperArm: { z: 1.2, x: -0.3 }, rightLowerArm: { z: -0.8 }, leftLowerArm: { z: 0.8 } } },
      { time: 1.5, bones: { rightUpperArm: { z: 0, x: 0 }, leftUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0 }, leftLowerArm: { z: 0 } } },
    ];

    this.playGesture(keyframes, 1.7);
  }

  // 悲しみのポーズ（うつむく）
  sad() {
    const keyframes = [
      { time: 0, bones: { head: { x: 0 }, neck: { x: 0 }, spine: { x: 0 } } },
      { time: 0.5, bones: { head: { x: 0.4 }, neck: { x: 0.2 }, spine: { x: 0.1 } } },
      { time: 2.0, bones: { head: { x: 0.4 }, neck: { x: 0.2 }, spine: { x: 0.1 } } },
      { time: 2.5, bones: { head: { x: 0 }, neck: { x: 0 }, spine: { x: 0 } } },
    ];

    this.playGesture(keyframes, 2.7);
  }

  // 驚きのポーズ（手を口元に）
  surprised() {
    const keyframes = [
      { time: 0, bones: { rightUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0 }, head: { x: 0 } } },
      { time: 0.2, bones: { rightUpperArm: { z: -0.8, x: -0.3 }, rightLowerArm: { z: -1.5 }, head: { x: -0.1 } } },
      { time: 1.2, bones: { rightUpperArm: { z: -0.8, x: -0.3 }, rightLowerArm: { z: -1.5 }, head: { x: -0.1 } } },
      { time: 1.7, bones: { rightUpperArm: { z: 0, x: 0 }, rightLowerArm: { z: 0 }, head: { x: 0 } } },
    ];

    this.playGesture(keyframes, 1.9);
  }

  // ジェスチャーを再生
  playGesture(keyframes, duration) {
    if (this.isPlaying) return; // 既にジェスチャー再生中の場合はスキップ

    this.gestureKeyframes = keyframes;
    this.gestureDuration = duration;
    this.gestureProgress = 0;
    this.isPlaying = true;

    // 使用するボーンの初期回転を保存
    const boneNames = new Set();
    keyframes.forEach(kf => {
      Object.keys(kf.bones).forEach(boneName => boneNames.add(boneName));
    });
    this.saveOriginalRotations([...boneNames]);
  }

  // アニメーションの更新（毎フレーム呼ぶ）
  update(delta) {
    if (!this.isPlaying) return;

    this.gestureProgress += delta;

    if (this.gestureProgress >= this.gestureDuration) {
      // アニメーション終了
      this.isPlaying = false;
      this.gestureProgress = 0;

      // ボーンを元に戻す
      this.gestureKeyframes.forEach(kf => {
        Object.keys(kf.bones).forEach(boneName => {
          this.resetBone(boneName);
        });
      });

      return;
    }

    // 現在の時間に対応するキーフレームを探す
    let currentKeyframe = null;
    let nextKeyframe = null;

    for (let i = 0; i < this.gestureKeyframes.length - 1; i++) {
      if (this.gestureProgress >= this.gestureKeyframes[i].time &&
          this.gestureProgress < this.gestureKeyframes[i + 1].time) {
        currentKeyframe = this.gestureKeyframes[i];
        nextKeyframe = this.gestureKeyframes[i + 1];
        break;
      }
    }

    if (!currentKeyframe || !nextKeyframe) return;

    // 補間率を計算
    const timeDiff = nextKeyframe.time - currentKeyframe.time;
    const progress = (this.gestureProgress - currentKeyframe.time) / timeDiff;
    const t = this.easeInOutCubic(progress);

    // ボーンの回転を補間
    const allBones = new Set([
      ...Object.keys(currentKeyframe.bones),
      ...Object.keys(nextKeyframe.bones)
    ]);

    allBones.forEach(boneName => {
      const bone = this.vrm.humanoid?.getRawBoneNode(boneName);
      if (!bone) return;

      const current = currentKeyframe.bones[boneName] || {};
      const next = nextKeyframe.bones[boneName] || {};

      if (current.x !== undefined && next.x !== undefined) {
        bone.rotation.x = current.x + (next.x - current.x) * t;
      }
      if (current.y !== undefined && next.y !== undefined) {
        bone.rotation.y = current.y + (next.y - current.y) * t;
      }
      if (current.z !== undefined && next.z !== undefined) {
        bone.rotation.z = current.z + (next.z - current.z) * t;
      }
    });
  }

  // イージング関数
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ジェスチャー再生中かどうか
  isPlayingGesture() {
    return this.isPlaying;
  }
}
