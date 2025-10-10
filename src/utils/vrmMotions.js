import * as THREE from 'three';

// VRMボーン名のマッピング
export const VRM_BONE_NAMES = {
  head: 'head',
  neck: 'neck',
  spine: 'spine',
  chest: 'chest',
  upperChest: 'upperChest',
  leftEye: 'leftEye',
  rightEye: 'rightEye',
  leftUpperArm: 'leftUpperArm',
  leftLowerArm: 'leftLowerArm',
  leftHand: 'leftHand',
  rightUpperArm: 'rightUpperArm',
  rightLowerArm: 'rightLowerArm',
  rightHand: 'rightHand',
  hips: 'hips',
  leftUpperLeg: 'leftUpperLeg',
  leftLowerLeg: 'leftLowerLeg',
  leftFoot: 'leftFoot',
  rightUpperLeg: 'rightUpperLeg',
  rightLowerLeg: 'rightLowerLeg',
  rightFoot: 'rightFoot'
};

// BlendShape（表情）名のマッピング
export const VRM_EXPRESSIONS = {
  neutral: 'neutral',
  happy: 'happy',
  angry: 'angry',
  sad: 'sad',
  relaxed: 'relaxed',
  surprised: 'surprised',
  blink: 'blink',
  blinkLeft: 'blinkLeft',
  blinkRight: 'blinkRight',
  lookUp: 'lookUp',
  lookDown: 'lookDown',
  lookLeft: 'lookLeft',
  lookRight: 'lookRight',
  aa: 'aa',
  ih: 'ih',
  ou: 'ou',
  ee: 'ee',
  oh: 'oh'
};

// アイドルモーション用クラス
export class IdleMotion {
  constructor(vrm) {
    this.vrm = vrm;
    this.time = 0;
    this.blinkTimer = 0;
    this.nextBlinkTime = Math.random() * 3 + 2;
    this.isBlinking = false;
    this.lookTarget = new THREE.Vector3(0, 0, 5);
    this.currentLookAt = new THREE.Vector3(0, 0, 5);
  }

  update(deltaTime) {
    if (!this.vrm) return;
    
    this.time += deltaTime;
    
    // 呼吸アニメーション
    this.applyBreathing();
    
    // 瞬き
    this.applyBlink(deltaTime);
    
    // 微細な頭の動き
    this.applyHeadSway();
    
    // 腕の自然な揺れ
    this.applyArmSway();
    
    // 視線追従（スムーズ）
    this.applyLookAt(deltaTime);
  }

  applyBreathing() {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const breathIntensity = 0.003;
    const breathSpeed = 2;
    
    // 胸部の呼吸
    const chest = humanoid.getRawBoneNode('chest');
    if (chest) {
      chest.rotation.x = Math.sin(this.time * breathSpeed) * breathIntensity;
    }
    
    // 上部胸部
    const upperChest = humanoid.getRawBoneNode('upperChest');
    if (upperChest) {
      upperChest.rotation.x = Math.sin(this.time * breathSpeed + 0.5) * breathIntensity * 0.7;
    }
    
    // 脊椎の微細な動き
    const spine = humanoid.getRawBoneNode('spine');
    if (spine) {
      spine.rotation.x = Math.sin(this.time * breathSpeed - 0.3) * breathIntensity * 0.5;
    }
  }

  applyBlink(deltaTime) {
    this.blinkTimer += deltaTime;

    if (this.blinkTimer >= this.nextBlinkTime && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkTimer = 0;

      // 瞬きアニメーション（VRM 1.0対応）
      const expressionManager = this.vrm.expressionManager || this.vrm.blendShapeProxy;
      if (expressionManager) {
        // 瞬き開始
        if (expressionManager.setValue) {
          expressionManager.setValue('blink', 1);
        } else if (expressionManager.setExpression) {
          expressionManager.setExpression('blink', 1);
        }

        // 100ms後に瞬き終了
        setTimeout(() => {
          const em = this.vrm.expressionManager || this.vrm.blendShapeProxy;
          if (em) {
            if (em.setValue) {
              em.setValue('blink', 0);
            } else if (em.setExpression) {
              em.setExpression('blink', 0);
            }
          }
          this.isBlinking = false;
          // 次の瞬きまでのランダム時間設定（2〜5秒）
          this.nextBlinkTime = Math.random() * 3 + 2;
        }, 100);
      }
    }
  }

  applyHeadSway() {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const head = humanoid.getRawBoneNode('head');
    const neck = humanoid.getRawBoneNode('neck');
    
    // ゆっくりとした頭の揺れ
    const swaySpeed = 0.5;
    const swayIntensity = 0.02;
    
    if (head) {
      head.rotation.y = Math.sin(this.time * swaySpeed) * swayIntensity;
      head.rotation.z = Math.cos(this.time * swaySpeed * 0.7) * swayIntensity * 0.5;
    }
    
    if (neck) {
      neck.rotation.y = Math.sin(this.time * swaySpeed + 1) * swayIntensity * 0.5;
      neck.rotation.z = Math.cos(this.time * swaySpeed * 0.7 + 1) * swayIntensity * 0.3;
    }
  }

  applyArmSway() {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const swaySpeed = 0.7;
    const swayIntensity = 0.01;
    
    // 左腕
    const leftUpperArm = humanoid.getRawBoneNode('leftUpperArm');
    if (leftUpperArm) {
      leftUpperArm.rotation.z = Math.sin(this.time * swaySpeed) * swayIntensity + 0.3;
    }
    
    // 右腕
    const rightUpperArm = humanoid.getRawBoneNode('rightUpperArm');
    if (rightUpperArm) {
      rightUpperArm.rotation.z = Math.sin(this.time * swaySpeed + Math.PI) * swayIntensity - 0.3;
    }
  }

  applyLookAt(deltaTime) {
    // スムーズな視線追従
    this.currentLookAt.lerp(this.lookTarget, deltaTime * 2);

    // VRM 1.0のlookAtは内部で自動更新されるため、targetを設定しない
    // 代わりに手動で視線制御を行う場合はhumanoidボーンを直接操作する
  }

  setLookTarget(x, y, z) {
    this.lookTarget.set(x, y, z);
  }
}

// プリセットモーション
export class PresetMotions {
  constructor(vrm) {
    this.vrm = vrm;
    this.currentMotion = null;
  }

  // 手を振るモーション
  wave() {
    if (!this.vrm?.humanoid) return;
    
    const rightUpperArm = this.vrm.humanoid.getRawBoneNode('rightUpperArm');
    const rightLowerArm = this.vrm.humanoid.getRawBoneNode('rightLowerArm');
    const rightHand = this.vrm.humanoid.getRawBoneNode('rightHand');
    
    if (rightUpperArm && rightLowerArm && rightHand) {
      // 腕を上げる
      rightUpperArm.rotation.z = -Math.PI / 2;
      rightLowerArm.rotation.y = Math.PI / 6;
      
      // 手を振る
      let waveCount = 0;
      const waveInterval = setInterval(() => {
        rightHand.rotation.z = Math.sin(waveCount * 0.5) * 0.5;
        waveCount++;
        if (waveCount > 20) {
          clearInterval(waveInterval);
          // 元に戻す
          rightUpperArm.rotation.z = 0;
          rightLowerArm.rotation.y = 0;
          rightHand.rotation.z = 0;
        }
      }, 100);
    }
  }

  // うなずきモーション
  nod() {
    if (!this.vrm?.humanoid) return;
    
    const head = this.vrm.humanoid.getRawBoneNode('head');
    const neck = this.vrm.humanoid.getRawBoneNode('neck');
    
    if (head && neck) {
      let nodCount = 0;
      const nodInterval = setInterval(() => {
        const angle = Math.sin(nodCount * 0.3) * 0.2;
        head.rotation.x = angle;
        neck.rotation.x = angle * 0.5;
        nodCount++;
        if (nodCount > 20) {
          clearInterval(nodInterval);
          head.rotation.x = 0;
          neck.rotation.x = 0;
        }
      }, 50);
    }
  }

  // ジャンプモーション
  jump() {
    if (!this.vrm) return;
    
    const scene = this.vrm.scene;
    const originalY = scene.position.y;
    
    let jumpTime = 0;
    const jumpInterval = setInterval(() => {
      const height = Math.sin(jumpTime * 0.15) * 0.5;
      scene.position.y = originalY + (height > 0 ? height : 0);
      jumpTime++;
      if (jumpTime > 20) {
        clearInterval(jumpInterval);
        scene.position.y = originalY;
      }
    }, 50);
  }

  // ダンスの基本動作
  dance() {
    if (!this.vrm?.humanoid) return;
    
    let danceTime = 0;
    const danceInterval = setInterval(() => {
      const t = danceTime * 0.1;
      
      // 体を左右に揺らす
      const hips = this.vrm.humanoid.getRawBoneNode('hips');
      if (hips) {
        hips.rotation.y = Math.sin(t) * 0.1;
        hips.position.y = Math.abs(Math.sin(t * 2)) * 0.02;
      }
      
      // 腕を振る
      const leftUpperArm = this.vrm.humanoid.getRawBoneNode('leftUpperArm');
      const rightUpperArm = this.vrm.humanoid.getRawBoneNode('rightUpperArm');
      if (leftUpperArm) leftUpperArm.rotation.z = Math.sin(t) * 0.3 + 0.3;
      if (rightUpperArm) rightUpperArm.rotation.z = -Math.sin(t) * 0.3 - 0.3;
      
      danceTime++;
      if (danceTime > 100) {
        clearInterval(danceInterval);
        // リセット
        if (hips) {
          hips.rotation.y = 0;
          hips.position.y = 0;
        }
        if (leftUpperArm) leftUpperArm.rotation.z = 0;
        if (rightUpperArm) rightUpperArm.rotation.z = 0;
      }
    }, 50);
  }
}

// マウス追従コントローラー
export class MouseFollower {
  constructor(vrm) {
    this.vrm = vrm;
    this.mousePosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0 };
    this.currentRotation = { x: 0, y: 0 };
  }

  setMousePosition(x, y) {
    // -1 to 1の範囲に正規化
    this.mousePosition.x = x;
    this.mousePosition.y = y;
    
    // ターゲット回転角を計算
    this.targetRotation.y = this.mousePosition.x * 0.5;
    this.targetRotation.x = -this.mousePosition.y * 0.3;
  }

  update(deltaTime) {
    if (!this.vrm?.humanoid) return;
    
    // スムーズに追従
    const lerpSpeed = deltaTime * 5;
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * lerpSpeed;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * lerpSpeed;
    
    // 頭と首に適用
    const head = this.vrm.humanoid.getRawBoneNode('head');
    const neck = this.vrm.humanoid.getRawBoneNode('neck');
    
    if (head) {
      head.rotation.y = this.currentRotation.y * 0.7;
      head.rotation.x = this.currentRotation.x * 0.7;
    }
    
    if (neck) {
      neck.rotation.y = this.currentRotation.y * 0.3;
      neck.rotation.x = this.currentRotation.x * 0.3;
    }
    
    // 視線追従は頭の動きで表現（lookAtは使用しない）
    // VRM 1.0のlookAtはtargetにObject3Dが必要なため、Vector3では動作しない
  }
}
