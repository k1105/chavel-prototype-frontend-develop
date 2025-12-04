# ページネーション仕様書

## 1. 概要
電子書籍リーダーにおける縦書きテキストのページネーション仕様を定義する。
本仕様では、表示領域に収まる最大量のテキストを動的に計算し、ブロック（段落）の途中であっても自然に改ページを行う。

## 2. 現状の課題
- 現在の実装：3ブロック固定での分割
- 問題点：
  - ブロックの長さに関係なく固定数で分割するため、ページごとのテキスト量が不均等
  - 短いブロックでは空白が多く、長いブロックでは読みきれない可能性がある
  - 実際の表示領域を考慮していない

## 3. 改善後の仕様

### 3.1 基本方針
- **DOM測定による分割**: 仮想DOM要素にテキストをレンダリングし、実際の表示サイズを測定して分割
- **文字種別対応**: 半角・全角・プロポーショナルフォントの幅の違いを正確に考慮
- **ブロック連結**: 複数のブロックを連結し、一つの連続したテキストとして扱う
- **ピクセル単位の分割**: 表示領域に収まる正確な位置で改ページ
- **チャプター境界**: チャプターの開始は必ず新しいページから始める
- **ブロックごとのスペース**: ブロック間の余白は不要で、連続の行と同じ幅を維持する

### 3.2 計算アルゴリズム

#### 3.2.1 DOM測定方式
```typescript
interface MeasurementContext {
  width: number;              // 表示領域の幅（px）
  height: number;             // 表示領域の高さ（px）
  fontSize: string;           // フォントサイズ（例: '16px'）
  lineHeight: number;         // 行の高さ（倍率）
  fontFamily: string;         // フォントファミリー（例: 'Noto Sans JP, sans-serif'）
  writingMode: 'vertical-rl' | 'horizontal-tb'; // 書字方向
  letterSpacing?: string;     // 文字間隔（例: '0.1em'）
  textCombineUpright?: string; // 縦書き時の横組み文字（例: 'digits 2'）
}

// 仮想DOM要素での測定
interface TextMeasurement {
  width: number;              // レンダリング後の実際の幅
  height: number;             // レンダリング後の実際の高さ
  characterCount: number;     // 収まった文字数
  lineBreaks: number[];       // 改行位置の配列
}
```

#### 3.2.2 ページ分割アルゴリズム
```typescript
interface PageBreakPoint {
  chapterId: number;
  blockId: number;
  characterStart: number; // ブロック内の開始文字位置
  characterEnd: number;   // ブロック内の終了文字位置
}

interface Page {
  id: number;
  content: string[];      // 表示するテキスト（複数ブロックにまたがる場合は配列）
  breakPoints: PageBreakPoint[];
}
```

### 3.3 処理フロー

1. **初期化**
   - 表示領域のサイズを取得
   - 測定用の仮想DOM要素を作成（非表示・絶対配置）
   - スタイル（フォント、書字方向、行高など）を適用

2. **チャプターごとの処理**
   - 各チャプターの開始は新しいページから開始
   - チャプター内のすべてのブロックを連結

3. **ページ分割（バイナリサーチ方式）**
   - 仮想DOM要素にテキストを追加
   - バイナリサーチで表示領域に収まる最大の文字位置を探索
   - オーバーフローを検出したら文字数を減らし、収まる範囲を特定
   - ブロック境界を記録して、どのブロックのどの位置で分割したか保持

4. **最適化処理**
   - 禁則処理（句読点が行頭に来ないように調整）
   - 文末調整（文の途中で改ページしないよう可能な限り調整）
   - 再測定して最終的な分割位置を確定

### 3.4 データ構造

#### 3.4.1 入力データ（BookContent）
```typescript
interface BookContent {
  id: number;
  title: string;
  author: string;
  chapters: Chapter[];
}

interface Chapter {
  id: number;
  title: string;
  blocks: Block[];
}

interface Block {
  id: number;
  type: 'paragraph' | 'conversation';
  text: string;
  speaker?: string; // conversation typeの場合
}
```

#### 3.4.2 ページネーション結果
```typescript
interface PaginationResult {
  totalPages: number;
  pages: PageData[];
  pageIndex: Map<string, number>; // 高速検索用のインデックス
}

interface PageData {
  pageNumber: number;
  content: PageContent[];
  position: PagePosition;
}

interface PageContent {
  text: string;
  type: 'paragraph' | 'conversation';
  speaker?: string;
  isPartial: boolean; // ブロックの一部かどうか
}

interface PagePosition {
  chapterId: number;
  startBlock: {
    id: number;
    offset: number; // ブロック内の開始位置
  };
  endBlock: {
    id: number;
    offset: number; // ブロック内の終了位置
  };
}
```

## 4. 実装上の考慮事項

### 4.1 パフォーマンス最適化
- **遅延計算**: 全ページを事前計算せず、必要に応じて計算
- **キャッシュ**: 計算済みのページデータをキャッシュ
- **仮想スクロール**: 表示中のページとその前後のみレンダリング

### 4.2 レスポンシブ対応
- ウィンドウリサイズ時の再計算
- デバイス回転時の対応
- フォントサイズ変更時の再計算

### 4.3 アクセシビリティ
- ページ位置の保持（リサイズ後も同じ位置を表示）
- 読み上げ機能との連携
- キーボードナビゲーション

## 5. 禁則処理

### 5.1 行頭禁則文字
```
、。，．・：；？！゛゜ヽヾゝゞ々ー）］｝」』】〕〉》
```

### 5.2 行末禁則文字
```
（［｛「『【〔〈《
```

### 5.3 分離禁則
- 数字の途中での改行を避ける
- 英単語の途中での改行を避ける

## 6. テスト要件

### 6.1 単体テスト
- 仮想DOM測定の正確性
- バイナリサーチによる最適位置探索
- ブロック分割の正確性
- 禁則処理の動作確認
- 異なるフォント・文字種での測定精度

### 6.2 統合テスト
- 様々な画面サイズでの表示確認
- パフォーマンステスト（1000ページ以上の書籍）
- メモリ使用量の確認

### 6.3 ユーザビリティテスト
- ページめくりの応答速度
- テキスト選択の動作
- ブックマーク機能との連携

## 7. 将来の拡張性

### 7.1 検討事項
- ルビ（振り仮名）対応
- 画像・図表の埋め込み
- 注釈・脚注の表示
- 段組みレイアウト
- 文字装飾（太字、斜体、下線等）

### 7.2 API設計
```typescript
class PaginationEngine {
  constructor(options: PaginationOptions);

  // ページ計算
  calculatePages(content: BookContent): PaginationResult;

  // 特定位置へジャンプ
  jumpToPosition(chapterId: number, blockId: number, offset: number): number;

  // ページ取得
  getPage(pageNumber: number): PageData;

  // 設定変更時の再計算
  recalculate(options: Partial<PaginationOptions>): void;

  // キャッシュクリア
  clearCache(): void;
}
```

## 8. 実装計画

### Phase 1: 基本実装（MVP）
- [ ] 仮想DOM測定コンテナの実装
- [ ] バイナリサーチによる最適分割位置の探索
- [ ] ブロック連結とページ分割
- [ ] 基本的な改ページ処理

### Phase 2: 最適化
- [ ] 禁則処理の実装
- [ ] キャッシュ機構の追加
- [ ] パフォーマンス最適化

### Phase 3: 拡張機能
- [ ] レスポンシブ対応
- [ ] アクセシビリティ機能
- [ ] 高度な文字装飾対応

## 9. 参考実装

### 9.1 仮想DOM測定の例
```typescript
class DOMPaginationMeasurer {
  private measurementContainer: HTMLDivElement;
  private textContainer: HTMLDivElement;

  constructor(private context: MeasurementContext) {
    // 測定用の非表示コンテナを作成
    this.measurementContainer = document.createElement('div');
    this.measurementContainer.style.cssText = `
      position: absolute;
      visibility: hidden;
      left: -9999px;
      top: 0;
      width: ${context.width}px;
      height: ${context.height}px;
      padding: 0;
      margin: 0;
      border: none;
      overflow: hidden;
    `;

    // テキスト用の内部コンテナ（縦書きスタイルを適用）
    this.textContainer = document.createElement('div');
    this.textContainer.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
      font-size: ${context.fontSize};
      line-height: ${context.lineHeight};
      font-family: ${context.fontFamily};
      writing-mode: ${context.writingMode};
      -webkit-writing-mode: ${context.writingMode};
      -ms-writing-mode: ${context.writingMode === 'vertical-rl' ? 'tb-rl' : 'lr-tb'};
      text-orientation: ${context.writingMode === 'vertical-rl' ? 'mixed' : 'sideways'};
      -webkit-text-orientation: ${context.writingMode === 'vertical-rl' ? 'mixed' : 'sideways'};
      overflow-wrap: break-word;
      word-break: normal;
      white-space: pre-wrap;
      direction: ${context.writingMode === 'vertical-rl' ? 'rtl' : 'ltr'};
    `;

    this.measurementContainer.appendChild(this.textContainer);
    document.body.appendChild(this.measurementContainer);
  }

  // テキストが表示領域に収まるかを測定
  measureText(text: string): TextMeasurement {
    this.textContainer.textContent = text;

    // 縦書きの場合、スクロール方向が変わることに注意
    const isVertical = this.context.writingMode === 'vertical-rl';

    // 縦書きの場合: scrollWidth が縦方向、scrollHeight が横方向
    // 横書きの場合: scrollWidth が横方向、scrollHeight が縦方向
    const scrollWidth = this.textContainer.scrollWidth;
    const scrollHeight = this.textContainer.scrollHeight;
    const clientWidth = this.measurementContainer.clientWidth;
    const clientHeight = this.measurementContainer.clientHeight;

    // オーバーフローの判定も書字方向に応じて変更
    let overflow: boolean;
    if (isVertical) {
      // 縦書き: 横方向（左から右）にページが増える
      overflow = scrollWidth > clientWidth;
    } else {
      // 横書き: 縦方向（上から下）にページが増える
      overflow = scrollHeight > clientHeight;
    }

    return {
      width: scrollWidth,
      height: scrollHeight,
      characterCount: text.length,
      lineBreaks: this.detectLineBreaks(),
      overflow: overflow
    };
  }

  // バイナリサーチで最適な分割位置を見つける
  findOptimalBreakPoint(text: string): number {
    let left = 0;
    let right = text.length;
    let bestFit = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const testText = text.substring(0, mid);
      const measurement = this.measureText(testText);

      if (!measurement.overflow) {
        bestFit = mid;
        left = mid + 1; // もっと多く入るか試す
      } else {
        right = mid - 1; // 少なくする
      }
    }

    // 禁則処理を適用
    return this.applyKinsoku(text, bestFit);
  }

  // 禁則処理
  private applyKinsoku(text: string, position: number): number {
    const kinsokuStart = '、。，．・：；？！゛゜ヽヾゝゞ々ー）］｝」』】〕〉》';
    const kinsokuEnd = '（［｛「『【〔〈《';

    // 分割位置の文字をチェック
    if (position > 0 && position < text.length) {
      const nextChar = text[position];
      const prevChar = text[position - 1];

      // 行頭禁則
      if (kinsokuStart.includes(nextChar)) {
        // 前の位置を探す
        for (let i = position - 1; i > 0; i--) {
          if (!kinsokuStart.includes(text[i])) {
            return i;
          }
        }
      }

      // 行末禁則
      if (kinsokuEnd.includes(prevChar)) {
        // 次の位置を探す
        for (let i = position + 1; i < text.length; i++) {
          if (!kinsokuEnd.includes(text[i - 1])) {
            return i;
          }
        }
      }
    }

    return position;
  }

  // 行の折り返し位置を検出（将来の拡張用）
  private detectLineBreaks(): number[] {
    // TODO: getClientRects() や Range API を使用して
    // 実際の行の折り返し位置を検出する実装
    return [];
  }

  destroy() {
    if (this.measurementContainer.parentNode) {
      this.measurementContainer.parentNode.removeChild(this.measurementContainer);
    }
  }
}
```

### 9.2 ページ分割の例
```typescript
function splitIntoPages(
  text: string,
  context: MeasurementContext
): string[] {
  const pages: string[] = [];
  const measurer = new DOMPaginationMeasurer(context);
  let currentPosition = 0;

  try {
    while (currentPosition < text.length) {
      const remainingText = text.substring(currentPosition);
      const breakPoint = measurer.findOptimalBreakPoint(remainingText);

      if (breakPoint === 0) {
        // 1文字も入らない場合は最低1文字は進める
        pages.push(remainingText.substring(0, 1));
        currentPosition += 1;
      } else {
        pages.push(remainingText.substring(0, breakPoint));
        currentPosition += breakPoint;
      }
    }
  } finally {
    measurer.destroy();
  }

  return pages;
}
```

## 10. まとめ
仮想DOM測定方式の採用により、以下の改善が期待できる：

### 10.1 精度の向上
- **文字幅の正確な測定**: 半角・全角・プロポーショナルフォントの幅の違いを正確に反映
- **ピクセル単位の最適化**: 表示領域を最大限活用する正確なページ分割
- **フォント依存の解消**: 実際のレンダリング結果に基づくため、フォントの違いを吸収

### 10.2 ユーザー体験の改善
- **自然な読書体験**: 文字の詰め込みや余白の不均等がない
- **多言語対応**: 日本語、英語、混在テキストでも正確に処理
- **レスポンシブ対応**: デバイスやウィンドウサイズの変更に柔軟に対応

### 10.3 技術的な利点
- **保守性の向上**: DOM測定により複雑な文字幅計算ロジックが不要
- **拡張性**: ルビ、文字装飾、画像などの要素追加が容易
- **ブラウザ互換性**: ブラウザの標準的なレンダリング機能を利用