import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Motion } from '@capacitor/motion';
import { Device } from '@capacitor/device';

export class MobileInteractions {
  constructor() {
    this.gestureHandlers = new Map();
    this.motionHandler = null;
    this.orientationHandler = null;
    this.isMobile = false;
    this.init();
  }

  async init() {
    const info = await Device.getInfo();
    this.isMobile = info.platform !== 'web';

    console.log('[MobileInteractions] Platform:', info.platform, 'isMobile:', this.isMobile);

    if (this.isMobile) {
      this.setupGestures();
      this.setupMotion();
      this.setupShakeDetection();
    }
  }

  // ========================================
  // ジェスチャー認識
  // ========================================

  setupGestures() {
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    let lastTap = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }, { passive: true });

    document.addEventListener('touchend', async (e) => {
      const touchDuration = Date.now() - touchStartTime;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartPos.x;
      const deltaY = touch.clientY - touchStartPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // ダブルタップ検出
      const now = Date.now();
      if (now - lastTap < 300) {
        this.trigger('doubleTap', { x: touch.clientX, y: touch.clientY });
        await this.haptic('medium');
        lastTap = 0;
      } else {
        lastTap = now;
      }

      // ロングタップ検出
      if (touchDuration > 500 && distance < 20) {
        this.trigger('longPress', { x: touch.clientX, y: touch.clientY });
        await this.haptic('heavy');
      }

      // スワイプ検出
      if (distance > 50) {
        const direction = Math.abs(deltaX) > Math.abs(deltaY)
          ? (deltaX > 0 ? 'right' : 'left')
          : (deltaY > 0 ? 'down' : 'up');

        this.trigger('swipe', { direction, distance });
        await this.haptic('light');
      }
    }, { passive: true });

    // ピンチ検出
    let initialDistance = 0;
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (initialDistance === 0) {
          initialDistance = distance;
        } else {
          const scale = distance / initialDistance;
          this.trigger('pinch', { scale });
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      initialDistance = 0;
    }, { passive: true });

    console.log('[MobileInteractions] Gestures initialized');
  }

  // ========================================
  // モーションセンサー（ジャイロ）
  // ========================================

  async setupMotion() {
    try {
      // 加速度センサー
      this.motionHandler = await Motion.addListener('accel', (event) => {
        // 加速度データ
        this.trigger('motion', {
          x: event.accelerationIncludingGravity.x,
          y: event.accelerationIncludingGravity.y,
          z: event.accelerationIncludingGravity.z
        });
      });

      // ジャイロデータ
      this.orientationHandler = await Motion.addListener('orientation', (event) => {
        this.trigger('orientation', {
          alpha: event.alpha,  // 回転（Z軸）
          beta: event.beta,    // 前後傾き（X軸）
          gamma: event.gamma   // 左右傾き（Y軸）
        });
      });

      console.log('[MobileInteractions] Motion sensors initialized');
    } catch (error) {
      console.log('[MobileInteractions] Motion sensors not available:', error);
    }
  }

  // ========================================
  // シェイク検出
  // ========================================

  setupShakeDetection() {
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastShakeTime = 0;
    const shakeThreshold = 15;
    const shakeDebounce = 1000; // 1秒間隔

    this.on('motion', ({ x, y, z }) => {
      const deltaX = Math.abs(x - lastX);
      const deltaY = Math.abs(y - lastY);
      const deltaZ = Math.abs(z - lastZ);

      const now = Date.now();
      if ((deltaX > shakeThreshold || deltaY > shakeThreshold || deltaZ > shakeThreshold)
          && (now - lastShakeTime > shakeDebounce)) {
        this.trigger('shake');
        this.haptic('heavy');
        lastShakeTime = now;
      }

      lastX = x;
      lastY = y;
      lastZ = z;
    });

    console.log('[MobileInteractions] Shake detection initialized');
  }

  // ========================================
  // ハプティクス（振動）
  // ========================================

  async haptic(style = 'medium') {
    if (!this.isMobile) return;

    try {
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      };

      await Haptics.impact({ style: styleMap[style] });
    } catch (error) {
      console.log('[MobileInteractions] Haptics not available:', error);
    }
  }

  async hapticNotification(type = 'success') {
    if (!this.isMobile) return;

    try {
      await Haptics.notification({ type });
    } catch (error) {
      console.log('[MobileInteractions] Haptics not available:', error);
    }
  }

  // ========================================
  // イベントシステム
  // ========================================

  on(event, handler) {
    if (!this.gestureHandlers.has(event)) {
      this.gestureHandlers.set(event, []);
    }
    this.gestureHandlers.get(event).push(handler);
  }

  trigger(event, data = {}) {
    const handlers = this.gestureHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  destroy() {
    if (this.motionHandler) {
      this.motionHandler.remove();
    }
    if (this.orientationHandler) {
      this.orientationHandler.remove();
    }
    this.gestureHandlers.clear();
    console.log('[MobileInteractions] Destroyed');
  }
}
