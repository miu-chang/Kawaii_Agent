/**
 * PMXファイルからマテリアルモーフ情報を抽出するパーサー
 */

class PMXParser {
  constructor(arrayBuffer) {
    this.view = new DataView(arrayBuffer);
    this.offset = 0;
    this.textEncoder = new TextDecoder('utf-8');

    // グローバル設定
    this.encoding = 0;
    this.additionalVec4 = 0;
    this.vertexIndexSize = 0;
    this.textureIndexSize = 0;
    this.materialIndexSize = 0;
    this.boneIndexSize = 0;
    this.morphIndexSize = 0;
    this.rigidBodyIndexSize = 0;
  }

  readText() {
    const length = this.view.getInt32(this.offset, true);
    this.offset += 4;

    if (length === 0) return '';

    const bytes = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;

    // UTF-16LE or UTF-8
    if (this.encoding === 0) {
      return new TextDecoder('utf-16le').decode(bytes);
    } else {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }

  readIndex(size) {
    let value;
    if (size === 1) {
      value = this.view.getInt8(this.offset);
      this.offset += 1;
    } else if (size === 2) {
      value = this.view.getInt16(this.offset, true);
      this.offset += 2;
    } else if (size === 4) {
      value = this.view.getInt32(this.offset, true);
      this.offset += 4;
    }
    return value;
  }

  readFloat() {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt() {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readByte() {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  parse() {
    // シグネチャチェック
    const sig = String.fromCharCode(
      this.view.getUint8(0),
      this.view.getUint8(1),
      this.view.getUint8(2),
      this.view.getUint8(3)
    );

    if (sig !== 'PMX ') {
      throw new Error('Not a PMX file');
    }

    this.offset = 4;

    // バージョン
    const version = this.view.getFloat32(this.offset, true);
    this.offset += 4;

    console.log('[PMX Parser] Version:', version);

    // グローバル設定
    const globalsCount = this.view.getUint8(this.offset);
    this.offset += 1;

    this.encoding = this.view.getUint8(this.offset); // 0=UTF16LE, 1=UTF8
    this.offset += 1;
    this.additionalVec4 = this.view.getUint8(this.offset);
    this.offset += 1;
    this.vertexIndexSize = this.view.getUint8(this.offset);
    this.offset += 1;
    this.textureIndexSize = this.view.getUint8(this.offset);
    this.offset += 1;
    this.materialIndexSize = this.view.getUint8(this.offset);
    this.offset += 1;
    this.boneIndexSize = this.view.getUint8(this.offset);
    this.offset += 1;
    this.morphIndexSize = this.view.getUint8(this.offset);
    this.offset += 1;
    this.rigidBodyIndexSize = this.view.getUint8(this.offset);
    this.offset += 1;

    console.log('[PMX Parser] Encoding:', this.encoding, 'Material Index Size:', this.materialIndexSize);

    // モデル情報
    this.readText(); // モデル名
    this.readText(); // モデル名英語
    this.readText(); // コメント
    this.readText(); // コメント英語

    // 頂点をスキップ
    const vertexCount = this.readInt();
    console.log('[PMX Parser] Skipping', vertexCount, 'vertices');
    this.skipVertices(vertexCount);

    // 面をスキップ
    const faceCount = this.readInt();
    console.log('[PMX Parser] Skipping', faceCount, 'faces');
    this.offset += faceCount * this.vertexIndexSize;

    // テクスチャをスキップ
    const textureCount = this.readInt();
    console.log('[PMX Parser] Skipping', textureCount, 'textures');
    for (let i = 0; i < textureCount; i++) {
      this.readText();
    }

    // マテリアルをスキップ
    const materialCount = this.readInt();
    console.log('[PMX Parser] Skipping', materialCount, 'materials');
    this.skipMaterials(materialCount);

    // ボーンをスキップ
    const boneCount = this.readInt();
    console.log('[PMX Parser] Skipping', boneCount, 'bones');
    this.skipBones(boneCount);

    // モーフを読み取り
    console.log('[PMX Parser] Morph section starts at offset:', this.offset);
    const morphCount = this.readInt();
    console.log('[PMX Parser] Reading', morphCount, 'morphs, offset after count:', this.offset);

    const morphs = [];
    for (let i = 0; i < morphCount; i++) {
      const startOffset = this.offset;
      console.log(`[PMX Morph ${i}] Starting at offset: ${startOffset}`);

      try {
        const morph = this.readMorph();
        if (morph) {
          morphs.push(morph);
        }
        console.log(`[PMX Morph ${i}] Finished at offset: ${this.offset}`);
      } catch (error) {
        console.error(`[PMX Morph ${i}] Failed at offset ${this.offset}:`, error);
        // ここでバッファの内容をダンプ
        const dumpStart = Math.max(0, startOffset - 20);
        const dumpEnd = Math.min(this.view.byteLength, startOffset + 20);
        const bytes = [];
        for (let j = dumpStart; j < dumpEnd; j++) {
          bytes.push(this.view.getUint8(j).toString(16).padStart(2, '0'));
        }
        console.error(`[PMX Morph ${i}] Bytes around offset ${startOffset}:`, bytes.join(' '));
        throw error;
      }
    }

    console.log('[PMX Parser] Found', morphs.filter(m => m.type === 8).length, 'material morphs');
    return morphs;
  }

  skipVertices(count) {
    for (let i = 0; i < count; i++) {
      // 位置 (vec3)
      this.offset += 12;
      // 法線 (vec3)
      this.offset += 12;
      // UV (vec2)
      this.offset += 8;
      // 追加UV (vec4 * additionalVec4)
      this.offset += 16 * this.additionalVec4;
      // ウェイト変形方式
      const weightType = this.readByte();

      // ウェイトデータ
      if (weightType === 0) { // BDEF1
        this.readIndex(this.boneIndexSize);
      } else if (weightType === 1) { // BDEF2
        this.readIndex(this.boneIndexSize);
        this.readIndex(this.boneIndexSize);
        this.offset += 4; // weight
      } else if (weightType === 2) { // BDEF4
        this.readIndex(this.boneIndexSize);
        this.readIndex(this.boneIndexSize);
        this.readIndex(this.boneIndexSize);
        this.readIndex(this.boneIndexSize);
        this.offset += 16; // weights
      } else if (weightType === 3) { // SDEF
        this.readIndex(this.boneIndexSize);
        this.readIndex(this.boneIndexSize);
        this.offset += 4; // weight
        this.offset += 36; // C, R0, R1
      }

      // エッジ倍率
      this.offset += 4;
    }
  }

  skipMaterials(count) {
    for (let i = 0; i < count; i++) {
      const startOffset = this.offset;

      const name = this.readText(); // 名前
      const nameEn = this.readText(); // 名前英語

      if (i < 2) {
        console.log(`[PMX Material ${i}] Name: ${name}, NameEn: ${nameEn}, offset after names: ${this.offset}`);
      }

      // Diffuse (4 floats)
      this.offset += 16;
      // Specular (3 floats)
      this.offset += 12;
      // Specular係数 (1 float)
      this.offset += 4;
      // Ambient (3 floats)
      this.offset += 12;
      // 描画フラグ (1 byte)
      this.offset += 1;
      // エッジ色 (4 floats)
      this.offset += 16;
      // エッジサイズ (1 float)
      this.offset += 4;

      if (i < 2) {
        console.log(`[PMX Material ${i}] offset after colors: ${this.offset}`);
      }

      // テクスチャindex
      this.readIndex(this.textureIndexSize);
      // スフィアテクスチャindex
      this.readIndex(this.textureIndexSize);
      // スフィアモード (1 byte) ← 抜けていた！
      this.offset += 1;

      if (i < 2) {
        console.log(`[PMX Material ${i}] offset after textures: ${this.offset}`);
      }

      // トゥーン共有フラグ
      const toonFlag = this.readByte();
      if (toonFlag === 0) {
        this.readIndex(this.textureIndexSize);
      } else {
        this.offset += 1;
      }

      if (i < 2) {
        console.log(`[PMX Material ${i}] toonFlag: ${toonFlag}, offset after toon: ${this.offset}`);
      }

      // メモ
      const beforeMemo = this.offset;
      try {
        this.readText();
        if (i < 2) {
          console.log(`[PMX Material ${i}] offset after memo: ${this.offset}`);
        }
      } catch (error) {
        console.error(`[PMX Material ${i}] Failed at memo, offset was ${beforeMemo}, buffer size: ${this.view.byteLength}`);
        throw error;
      }

      // 面頂点数
      this.readInt();

      if (i < 2) {
        console.log(`[PMX Material ${i}] Total bytes: ${this.offset - startOffset}, final offset: ${this.offset}`);
      }
    }
  }

  skipDisplayFrames(count) {
    for (let i = 0; i < count; i++) {
      this.readText(); // 枠名
      this.readText(); // 枠名英語
      this.readByte(); // 特殊枠フラグ

      const elementCount = this.readInt();
      for (let j = 0; j < elementCount; j++) {
        const targetType = this.readByte(); // 0=ボーン, 1=モーフ
        if (targetType === 0) {
          this.readIndex(this.boneIndexSize);
        } else {
          this.readIndex(this.morphIndexSize);
        }
      }
    }
  }

  skipBones(count) {
    for (let i = 0; i < count; i++) {
      const startOffset = this.offset;

      const name = this.readText(); // 名前
      const nameEn = this.readText(); // 名前英語

      if (i < 2 || i === count - 1) {
        console.log(`[PMX Bone ${i}] Name: ${name}, offset after names: ${this.offset}`);
      }

      this.offset += 12; // 位置
      this.readIndex(this.boneIndexSize); // 親ボーン
      this.offset += 4; // 変形階層

      const flag = this.view.getUint16(this.offset, true);
      this.offset += 2;

      if (i < 2 || i === count - 1) {
        console.log(`[PMX Bone ${i}] flag: 0x${flag.toString(16)}, offset: ${this.offset}`);
      }

      // 接続先
      if (flag & 0x0001) {
        this.readIndex(this.boneIndexSize);
      } else {
        this.offset += 12;
      }

      // 回転付与/移動付与
      if (flag & 0x0100 || flag & 0x0200) {
        this.readIndex(this.boneIndexSize);
        this.offset += 4; // 付与率
      }

      // 軸固定
      if (flag & 0x0400) {
        this.offset += 12;
      }

      // ローカル軸
      if (flag & 0x0800) {
        this.offset += 24;
      }

      // 外部親変形
      if (flag & 0x2000) {
        this.offset += 4;
      }

      // IK
      if (flag & 0x0020) {
        this.readIndex(this.boneIndexSize); // IKターゲット
        this.offset += 8; // ループ回数、制限角度
        const ikLinkCount = this.readInt();
        for (let j = 0; j < ikLinkCount; j++) {
          this.readIndex(this.boneIndexSize);
          const hasLimit = this.readByte();
          if (hasLimit) {
            this.offset += 24; // 制限角度
          }
        }
      }

      if (i < 2 || i === count - 1) {
        console.log(`[PMX Bone ${i}] Total bytes: ${this.offset - startOffset}, final offset: ${this.offset}`);
      }
    }
  }

  readMorph() {
    const name = this.readText();
    const nameEn = this.readText();
    const panel = this.readByte();
    const type = this.readByte();
    const offsetCount = this.readInt();

    const morph = {
      name,
      nameEn,
      panel,
      type,
      elements: []
    };

    // マテリアルモーフ (type=8) のみ詳細読み取り
    if (type === 8) {
      for (let i = 0; i < offsetCount; i++) {
        const element = {
          index: this.readIndex(this.materialIndexSize),
          calcMode: this.readByte(),
          diffuse: [this.readFloat(), this.readFloat(), this.readFloat(), this.readFloat()],
          specular: [this.readFloat(), this.readFloat(), this.readFloat()],
          specularPower: this.readFloat(),
          ambient: [this.readFloat(), this.readFloat(), this.readFloat()],
          edgeColor: [this.readFloat(), this.readFloat(), this.readFloat(), this.readFloat()],
          edgeSize: this.readFloat(),
          textureColor: [this.readFloat(), this.readFloat(), this.readFloat(), this.readFloat()],
          sphereColor: [this.readFloat(), this.readFloat(), this.readFloat(), this.readFloat()],
          toonColor: [this.readFloat(), this.readFloat(), this.readFloat(), this.readFloat()]
        };
        morph.elements.push(element);
      }
      console.log('[PMX Parser] Material morph:', name, 'with', offsetCount, 'elements');
      return morph;
    } else {
      // その他のモーフはスキップ
      this.skipMorphData(type, offsetCount);
      return null;
    }
  }

  skipMorphData(type, count) {
    for (let i = 0; i < count; i++) {
      if (type === 0) { // グループ
        this.readIndex(this.morphIndexSize);
        this.offset += 4; // 影響度
      } else if (type === 1) { // 頂点
        this.readIndex(this.vertexIndexSize);
        this.offset += 12; // offset vec3
      } else if (type === 2) { // ボーン
        this.readIndex(this.boneIndexSize);
        this.offset += 12; // 移動量 vec3
        this.offset += 16; // 回転量 vec4
      } else if (type >= 3 && type <= 7) { // UV/追加UV
        this.readIndex(this.vertexIndexSize);
        this.offset += 16; // offset vec4
      }
    }
  }
}

export async function parsePMXMaterialMorphs(url) {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const parser = new PMXParser(buffer);
    const morphs = parser.parse();

    return morphs.filter(m => m && m.type === 8);
  } catch (error) {
    console.error('[PMX Parser] Error:', error);
    return [];
  }
}
