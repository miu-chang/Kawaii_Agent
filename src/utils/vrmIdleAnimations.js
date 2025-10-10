// VRMモデルのアイドルアニメーションシステム

export class IdleAnimationManager {
  constructor(vrm) {
    this.vrm = vrm;
    this.currentAnimation = null;
    this.animationProgress = 0;
    this.animationDuration = 0;
    this.animationKeyframes = [];
    this.isPlaying = false;
    this.originalRotations = new Map();
    this.originalPositions = new Map();
    this.idleTimer = 0;
    this.nextIdleTime = Math.random() * 5 + 5; // 5-10秒でランダムにアイドル開始
  }

  // ボーンの初期回転と位置を保存
  saveOriginalTransforms(boneNames) {
    boneNames.forEach(boneName => {
      const bone = this.vrm.humanoid?.getRawBoneNode(boneName);
      if (bone) {
        if (!this.originalRotations.has(boneName)) {
          this.originalRotations.set(boneName, {
            x: bone.rotation.x,
            y: bone.rotation.y,
            z: bone.rotation.z
          });
        }
        if (!this.originalPositions.has(boneName)) {
          this.originalPositions.set(boneName, {
            x: bone.position.x,
            y: bone.position.y,
            z: bone.position.z
          });
        }
      }
    });

    // VRMシーン全体の位置も保存
    if (!this.originalPositions.has('_scene')) {
      this.originalPositions.set('_scene', {
        x: this.vrm.scene.position.x,
        y: this.vrm.scene.position.y,
        z: this.vrm.scene.position.z
      });
    }
  }

  // ボーンを初期位置に戻す
  resetBone(boneName) {
    const bone = this.vrm.humanoid?.getRawBoneNode(boneName);
    const originalRot = this.originalRotations.get(boneName);
    const originalPos = this.originalPositions.get(boneName);

    if (bone && originalRot) {
      bone.rotation.x = originalRot.x;
      bone.rotation.y = originalRot.y;
      bone.rotation.z = originalRot.z;
    }

    if (bone && originalPos) {
      bone.position.x = originalPos.x;
      bone.position.y = originalPos.y;
      bone.position.z = originalPos.z;
    }
  }

  // 歩き回るアニメーション
  walk() {
    const keyframes = [
      {
        time: 0,
        bones: {
          hips: { posY: 0, posX: 0 },
          leftUpperLeg: { x: 0 },
          rightUpperLeg: { x: 0 },
          leftLowerLeg: { x: 0 },
          rightLowerLeg: { x: 0 }
        },
        scene: { posX: 0, posZ: 0 }
      },
      {
        time: 0.5,
        bones: {
          hips: { posY: -0.05, posX: 0.02 },
          leftUpperLeg: { x: 0.6 },
          rightUpperLeg: { x: -0.3 },
          leftLowerLeg: { x: -0.3 },
          rightLowerLeg: { x: 0.6 }
        },
        scene: { posX: -0.3, posZ: 0.3 }
      },
      {
        time: 1.0,
        bones: {
          hips: { posY: 0, posX: 0 },
          leftUpperLeg: { x: 0 },
          rightUpperLeg: { x: 0 },
          leftLowerLeg: { x: 0 },
          rightLowerLeg: { x: 0 }
        },
        scene: { posX: -0.5, posZ: 0.5 }
      },
      {
        time: 1.5,
        bones: {
          hips: { posY: -0.05, posX: -0.02 },
          leftUpperLeg: { x: -0.3 },
          rightUpperLeg: { x: 0.6 },
          leftLowerLeg: { x: 0.6 },
          rightLowerLeg: { x: -0.3 }
        },
        scene: { posX: -0.3, posZ: 0.3 }
      },
      {
        time: 2.0,
        bones: {
          hips: { posY: 0, posX: 0 },
          leftUpperLeg: { x: 0 },
          rightUpperLeg: { x: 0 },
          leftLowerLeg: { x: 0 },
          rightLowerLeg: { x: 0 }
        },
        scene: { posX: 0, posZ: 0 }
      },
    ];

    this.playAnimation('walk', keyframes, 2.2);
  }

  // 覗き込むアニメーション
  peek() {
    const keyframes = [
      {
        time: 0,
        bones: {
          spine: { x: 0, y: 0, z: 0 },
          chest: { x: 0, z: 0 },
          head: { x: 0, y: 0, z: 0 },
          neck: { x: 0, y: 0 }
        },
        scene: { posX: 0, posZ: 0 }
      },
      {
        time: 0.8,
        bones: {
          spine: { x: 0.3, y: 0.2, z: 0.1 },
          chest: { x: 0.2, z: 0.1 },
          head: { x: -0.3, y: 0.3, z: 0.2 },
          neck: { x: 0.2, y: 0.2 }
        },
        scene: { posX: 0.5, posZ: 0.8 }
      },
      {
        time: 2.5,
        bones: {
          spine: { x: 0.3, y: 0.2, z: 0.1 },
          chest: { x: 0.2, z: 0.1 },
          head: { x: -0.3, y: 0.3, z: 0.2 },
          neck: { x: 0.2, y: 0.2 }
        },
        scene: { posX: 0.5, posZ: 0.8 }
      },
      {
        time: 3.3,
        bones: {
          spine: { x: 0, y: 0, z: 0 },
          chest: { x: 0, z: 0 },
          head: { x: 0, y: 0, z: 0 },
          neck: { x: 0, y: 0 }
        },
        scene: { posX: 0, posZ: 0 }
      },
    ];

    this.playAnimation('peek', keyframes, 3.5);
  }

  // リラックスアニメーション
  relax() {
    const keyframes = [
      {
        time: 0,
        bones: {
          spine: { x: 0, z: 0 },
          chest: { x: 0 },
          rightUpperArm: { z: 0, x: 0 },
          leftUpperArm: { z: 0, x: 0 },
          rightLowerArm: { z: 0 },
          leftLowerArm: { z: 0 },
          head: { x: 0, z: 0 }
        }
      },
      {
        time: 1.0,
        bones: {
          spine: { x: -0.15, z: 0.1 },
          chest: { x: -0.1 },
          rightUpperArm: { z: -0.6, x: 0.4 },
          leftUpperArm: { z: 0.6, x: 0.4 },
          rightLowerArm: { z: -0.8 },
          leftLowerArm: { z: 0.8 },
          head: { x: 0.15, z: 0.15 }
        }
      },
      {
        time: 4.0,
        bones: {
          spine: { x: -0.15, z: 0.1 },
          chest: { x: -0.1 },
          rightUpperArm: { z: -0.6, x: 0.4 },
          leftUpperArm: { z: 0.6, x: 0.4 },
          rightLowerArm: { z: -0.8 },
          leftLowerArm: { z: 0.8 },
          head: { x: 0.15, z: 0.15 }
        }
      },
      {
        time: 5.0,
        bones: {
          spine: { x: 0, z: 0 },
          chest: { x: 0 },
          rightUpperArm: { z: 0, x: 0 },
          leftUpperArm: { z: 0, x: 0 },
          rightLowerArm: { z: 0 },
          leftLowerArm: { z: 0 },
          head: { x: 0, z: 0 }
        }
      },
    ];

    this.playAnimation('relax', keyframes, 5.2);
  }

  // ストレッチアニメーション
  stretch() {
    const keyframes = [
      {
        time: 0,
        bones: {
          spine: { x: 0 },
          chest: { x: 0 },
          rightUpperArm: { z: 0, x: 0 },
          leftUpperArm: { z: 0, x: 0 },
          rightLowerArm: { z: 0 },
          leftLowerArm: { z: 0 },
          head: { x: 0 }
        }
      },
      {
        time: 0.8,
        bones: {
          spine: { x: -0.2 },
          chest: { x: -0.3 },
          rightUpperArm: { z: -1.5, x: -0.5 },
          leftUpperArm: { z: 1.5, x: -0.5 },
          rightLowerArm: { z: -0.3 },
          leftLowerArm: { z: 0.3 },
          head: { x: -0.2 }
        }
      },
      {
        time: 2.5,
        bones: {
          spine: { x: -0.2 },
          chest: { x: -0.3 },
          rightUpperArm: { z: -1.5, x: -0.5 },
          leftUpperArm: { z: 1.5, x: -0.5 },
          rightLowerArm: { z: -0.3 },
          leftLowerArm: { z: 0.3 },
          head: { x: -0.2 }
        }
      },
      {
        time: 3.3,
        bones: {
          spine: { x: 0 },
          chest: { x: 0 },
          rightUpperArm: { z: 0, x: 0 },
          leftUpperArm: { z: 0, x: 0 },
          rightLowerArm: { z: 0 },
          leftLowerArm: { z: 0 },
          head: { x: 0 }
        }
      },
    ];

    this.playAnimation('stretch', keyframes, 3.5);
  }

  // 首をかしげる
  tilt() {
    const keyframes = [
      {
        time: 0,
        bones: {
          head: { x: 0, z: 0 },
          neck: { x: 0, z: 0 }
        }
      },
      {
        time: 0.5,
        bones: {
          head: { x: 0.2, z: 0.3 },
          neck: { x: 0.1, z: 0.2 }
        }
      },
      {
        time: 2.0,
        bones: {
          head: { x: 0.2, z: 0.3 },
          neck: { x: 0.1, z: 0.2 }
        }
      },
      {
        time: 2.5,
        bones: {
          head: { x: 0, z: 0 },
          neck: { x: 0, z: 0 }
        }
      },
    ];

    this.playAnimation('tilt', keyframes, 2.7);
  }

  // アニメーションを再生
  playAnimation(name, keyframes, duration) {
    if (this.isPlaying) return;

    this.currentAnimation = name;
    this.animationKeyframes = keyframes;
    this.animationDuration = duration;
    this.animationProgress = 0;
    this.isPlaying = true;

    // 使用するボーンの初期状態を保存
    const boneNames = new Set();
    keyframes.forEach(kf => {
      if (kf.bones) {
        Object.keys(kf.bones).forEach(boneName => boneNames.add(boneName));
      }
    });
    this.saveOriginalTransforms([...boneNames]);

    console.log('Playing idle animation:', name);
  }

  // ランダムなアイドルアニメーションを開始
  playRandomIdle() {
    const animations = ['walk', 'peek', 'relax', 'stretch', 'tilt'];
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];

    switch (randomAnim) {
      case 'walk':
        this.walk();
        break;
      case 'peek':
        this.peek();
        break;
      case 'relax':
        this.relax();
        break;
      case 'stretch':
        this.stretch();
        break;
      case 'tilt':
        this.tilt();
        break;
    }
  }

  // アニメーションの更新（毎フレーム呼ぶ）
  update(delta, isUserActive = false) {
    // ユーザーアクティビティがある場合はタイマーリセット
    if (isUserActive) {
      this.idleTimer = 0;

      // アクティブ中にアニメーション再生中なら停止
      if (this.isPlaying) {
        this.stopAnimation();
      }
      return;
    }

    // アイドルタイマーを進める
    this.idleTimer += delta;

    // アニメーション再生中でない、かつ、次のアイドル時間に達した場合
    if (!this.isPlaying && this.idleTimer >= this.nextIdleTime) {
      this.playRandomIdle();
      this.idleTimer = 0;
      this.nextIdleTime = Math.random() * 10 + 5; // 5-15秒でランダム
    }

    // アニメーション再生中の更新
    if (!this.isPlaying) return;

    this.animationProgress += delta;

    if (this.animationProgress >= this.animationDuration) {
      // アニメーション終了
      this.stopAnimation();
      return;
    }

    // 現在の時間に対応するキーフレームを探す
    let currentKeyframe = null;
    let nextKeyframe = null;

    for (let i = 0; i < this.animationKeyframes.length - 1; i++) {
      if (this.animationProgress >= this.animationKeyframes[i].time &&
          this.animationProgress < this.animationKeyframes[i + 1].time) {
        currentKeyframe = this.animationKeyframes[i];
        nextKeyframe = this.animationKeyframes[i + 1];
        break;
      }
    }

    if (!currentKeyframe || !nextKeyframe) return;

    // 補間率を計算
    const timeDiff = nextKeyframe.time - currentKeyframe.time;
    const progress = (this.animationProgress - currentKeyframe.time) / timeDiff;
    const t = this.easeInOutCubic(progress);

    // ボーンの回転・位置を補間
    if (currentKeyframe.bones && nextKeyframe.bones) {
      const allBones = new Set([
        ...Object.keys(currentKeyframe.bones),
        ...Object.keys(nextKeyframe.bones)
      ]);

      allBones.forEach(boneName => {
        const bone = this.vrm.humanoid?.getRawBoneNode(boneName);
        if (!bone) return;

        const current = currentKeyframe.bones[boneName] || {};
        const next = nextKeyframe.bones[boneName] || {};

        // 回転
        if (current.x !== undefined && next.x !== undefined) {
          bone.rotation.x = current.x + (next.x - current.x) * t;
        }
        if (current.y !== undefined && next.y !== undefined) {
          bone.rotation.y = current.y + (next.y - current.y) * t;
        }
        if (current.z !== undefined && next.z !== undefined) {
          bone.rotation.z = current.z + (next.z - current.z) * t;
        }

        // 位置
        if (current.posX !== undefined && next.posX !== undefined) {
          bone.position.x = current.posX + (next.posX - current.posX) * t;
        }
        if (current.posY !== undefined && next.posY !== undefined) {
          bone.position.y = current.posY + (next.posY - current.posY) * t;
        }
        if (current.posZ !== undefined && next.posZ !== undefined) {
          bone.position.z = current.posZ + (next.posZ - current.posZ) * t;
        }
      });
    }

    // シーン全体の移動
    if (currentKeyframe.scene && nextKeyframe.scene) {
      const currentScene = currentKeyframe.scene;
      const nextScene = nextKeyframe.scene;
      const originalPos = this.originalPositions.get('_scene');

      if (originalPos) {
        if (currentScene.posX !== undefined && nextScene.posX !== undefined) {
          this.vrm.scene.position.x = originalPos.x + currentScene.posX + (nextScene.posX - currentScene.posX) * t;
        }
        if (currentScene.posY !== undefined && nextScene.posY !== undefined) {
          this.vrm.scene.position.y = originalPos.y + currentScene.posY + (nextScene.posY - currentScene.posY) * t;
        }
        if (currentScene.posZ !== undefined && nextScene.posZ !== undefined) {
          this.vrm.scene.position.z = originalPos.z + currentScene.posZ + (nextScene.posZ - currentScene.posZ) * t;
        }
      }
    }
  }

  // アニメーション停止
  stopAnimation() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.animationProgress = 0;

    // ボーンを元に戻す
    this.animationKeyframes.forEach(kf => {
      if (kf.bones) {
        Object.keys(kf.bones).forEach(boneName => {
          this.resetBone(boneName);
        });
      }
    });

    // シーンの位置を戻す
    const originalPos = this.originalPositions.get('_scene');
    if (originalPos) {
      this.vrm.scene.position.x = originalPos.x;
      this.vrm.scene.position.y = originalPos.y;
      this.vrm.scene.position.z = originalPos.z;
    }

    console.log('Stopped idle animation');
  }

  // イージング関数
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // アニメーション再生中かどうか
  isPlayingAnimation() {
    return this.isPlaying;
  }
}
