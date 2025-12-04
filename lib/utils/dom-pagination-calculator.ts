import type { BookContent, Chapter, Block, Page, PaginationState } from '@/types/pagination'

/**
 * DOM測定用のコンテキスト設定
 */
export interface MeasurementContext {
  width: number                // 表示領域の幅（px）
  height: number               // 表示領域の高さ（px）
  fontSize: string             // フォントサイズ（例: '16px'）
  lineHeight: number           // 行の高さ（倍率）
  fontFamily: string           // フォントファミリー
  writingMode: 'vertical-rl' | 'horizontal-tb' // 書字方向
  letterSpacing?: string       // 文字間隔（例: '0.1em'）
  textCombineUpright?: string  // 縦書き時の横組み文字
}

/**
 * テキスト測定結果
 */
interface TextMeasurement {
  width: number                // レンダリング後の実際の幅
  height: number               // レンダリング後の実際の高さ
  characterCount: number       // 収まった文字数
  overflow: boolean            // オーバーフロー発生フラグ
}

/**
 * ページ分割ポイント
 */
interface PageBreakPoint {
  chapterId: number
  blockId: number
  characterStart: number       // ブロック内の開始文字位置
  characterEnd: number         // ブロック内の終了文字位置
}

/**
 * DOM測定によるページネーション計算機
 */
export class DOMPaginationCalculator {
  private measurementContainer: HTMLDivElement | null = null
  private textContainer: HTMLDivElement | null = null
  private titleSpace: HTMLDivElement | null = null
  private pages: Page[] = []
  private totalCharacters = 0
  private readonly kinsokuStart = '、。，．・：；？！゛゜ヽヾゝゞ々ー）］｝」』】〕〉》'
  private readonly kinsokuEnd = '（［｛「『【〔〈《'

  constructor(
    private bookContent: BookContent,
    private context: MeasurementContext
  ) {
    this.initializeMeasurementContainer()
    this.calculatePages()
  }

  /**
   * 測定用コンテナを初期化（実際の表示構造に合わせる）
   */
  private initializeMeasurementContainer(): void {
    // 最外側のコンテナ（containerRefと同じサイズ）
    this.measurementContainer = document.createElement('div')
    this.measurementContainer.style.cssText = `
      position: absolute;
      visibility: hidden;
      left: -9999px;
      top: 0;
      width: ${this.context.width}px;
      height: ${this.context.height}px;
      margin: 0;
      border: none;
      overflow: hidden;
      background-color: rgb(249, 250, 251);
    `

    // px-12 py-8 box-border相当のコンテナ
    const paddingContainer = document.createElement('div')
    paddingContainer.style.cssText = `
      height: 100%;
      width: 100%;
      padding: 32px 48px;
      box-sizing: border-box;
      margin: 0;
      border: none;
    `

    // vertical-textクラス相当のコンテナ（flexレイアウト）
    const verticalContainer = document.createElement('div')
    const isVertical = this.context.writingMode === 'vertical-rl'

    verticalContainer.style.cssText = `
      height: 100%;
      width: 100%;
      position: relative;
      -webkit-writing-mode: vertical-rl;
      -ms-writing-mode: tb-rl;
      writing-mode: vertical-rl;
      -webkit-text-orientation: upright;
      text-orientation: upright;
      direction: rtl;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      font-size: ${this.context.fontSize};
      line-height: ${this.context.lineHeight};
      display: flex;
      flex-direction: row;
    `

    // 章タイトルエリア（w-16相当＝64px）
    this.titleSpace = document.createElement('div')
    this.titleSpace.style.cssText = `
      height: 100%;
      width: 64px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-start;
      padding: 0 48px;
      box-sizing: border-box;
      flex-shrink: 0;
    `

    // 内側のテキストコンテナ（vertical-text-content相当）
    this.textContainer = document.createElement('div')
    this.textContainer.style.cssText = `
      white-space: pre-line;
      height: calc(100% - 60px);
      padding: 24px;
      color: rgb(31, 41, 55);
      font-size: ${this.context.fontSize};
      line-height: ${this.context.lineHeight};
      font-family: ${this.context.fontFamily};
      -webkit-writing-mode: vertical-rl;
      -ms-writing-mode: tb-rl;
      writing-mode: vertical-rl;
      -webkit-text-orientation: mixed;
      text-orientation: mixed;
      direction: ltr;
      overflow: visible;
      letter-spacing: 0.1em;
      -webkit-text-combine-upright: digits 2;
      -ms-text-combine-horizontal: digits 2;
      text-combine-upright: digits 2;
      -webkit-hanging-punctuation: first last;
      hanging-punctuation: first last;
      columns: none;
      -webkit-columns: none;
      -moz-columns: none;
      -webkit-font-feature-settings: "halt";
      font-feature-settings: "halt";
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: normal;
      flex: 1;
      width: auto;
      ${this.context.letterSpacing ? `letter-spacing: ${this.context.letterSpacing};` : ''}
      ${this.context.textCombineUpright ? `text-combine-upright: ${this.context.textCombineUpright};` : ''}
    `

    verticalContainer.appendChild(this.titleSpace)
    verticalContainer.appendChild(this.textContainer)
    paddingContainer.appendChild(verticalContainer)
    this.measurementContainer.appendChild(paddingContainer)
    document.body.appendChild(this.measurementContainer)
  }


  /**
   * テキストが表示領域に収まるかを測定
   */
  private measureText(text: string): TextMeasurement {
    if (!this.textContainer || !this.measurementContainer) {
      throw new Error('Measurement container not initialized')
    }

    this.textContainer.textContent = text

    const isVertical = this.context.writingMode === 'vertical-rl'
    const scrollWidth = this.textContainer.scrollWidth
    const scrollHeight = this.textContainer.scrollHeight
    const clientWidth = this.measurementContainer.clientWidth
    const clientHeight = this.measurementContainer.clientHeight

    // 縦書きと横書きでオーバーフローの判定方向が異なる
    const overflow = isVertical
      ? scrollWidth > clientWidth   // 縦書き: 横方向にページが増える
      : scrollHeight > clientHeight  // 横書き: 縦方向にページが増える

    // 実際のテキストコンテナのサイズをデバッグ出力
    const textClientWidth = this.textContainer.clientWidth
    const textClientHeight = this.textContainer.clientHeight

    // DOM階層の各レベルでのサイズを測定
    const paddingContainer = this.measurementContainer.firstChild as HTMLElement
    const verticalContainer = paddingContainer.firstChild as HTMLElement

    console.log(`🔍 DOM測定コンテナサイズ詳細:
1⃣ INPUT: ${this.context.width}×${this.context.height}px (usePaginationから入力)
2⃣ MEASUREMENT: ${clientWidth}×${clientHeight}px (最外側コンテナ)
3⃣ PADDING: ${paddingContainer.clientWidth}×${paddingContainer.clientHeight}px (px-12 py-8相当, 期待値: ${this.context.width - 96}×${this.context.height - 64}px)
4⃣ VERTICAL: ${verticalContainer.clientWidth}×${verticalContainer.clientHeight}px (vertical-text)
5⃣ TEXT: ${textClientWidth}×${textClientHeight}px (期待値: ${verticalContainer.clientWidth - 64 - 48}px幅)
6⃣ SCROLL: ${scrollWidth}×${scrollHeight}px (実際のテキストサイズ)
7⃣ OVERFLOW: ${overflow ? 'YES' : 'NO'} (${isVertical ? 'scrollWidth > containerWidth' : 'scrollHeight > containerHeight'})`)

    return {
      width: scrollWidth,
      height: scrollHeight,
      characterCount: text.length,
      overflow
    }
  }

  /**
   * バイナリサーチで最適な分割位置を見つける
   */
  private findOptimalBreakPoint(text: string): number {
    let left = 0
    let right = text.length
    let bestFit = 0

    // 空テキストの場合は0を返す
    if (text.length === 0) return 0

    // バイナリサーチで最適な位置を探索
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const testText = text.substring(0, mid)
      const measurement = this.measureText(testText)

      if (!measurement.overflow) {
        bestFit = mid
        left = mid + 1  // もっと多く入るか試す
      } else {
        right = mid - 1 // 少なくする
      }
    }

    // 禁則処理を適用
    return this.applyKinsoku(text, bestFit)
  }

  /**
   * 禁則処理
   */
  private applyKinsoku(text: string, position: number): number {
    // 端の場合は処理不要
    if (position <= 0 || position >= text.length) {
      return position
    }

    const nextChar = text[position]
    const prevChar = text[position - 1]

    // 行頭禁則: 次の文字が行頭に来てはいけない文字
    if (this.kinsokuStart.includes(nextChar)) {
      // 前の安全な位置を探す
      for (let i = position - 1; i > 0; i--) {
        if (!this.kinsokuStart.includes(text[i])) {
          // 測定して収まるか確認
          const testText = text.substring(0, i)
          const measurement = this.measureText(testText)
          if (!measurement.overflow) {
            return i
          }
        }
      }
    }

    // 行末禁則: 前の文字が行末に来てはいけない文字
    if (this.kinsokuEnd.includes(prevChar)) {
      // 次の安全な位置を探す
      for (let i = position + 1; i < text.length && i < position + 10; i++) {
        if (!this.kinsokuEnd.includes(text[i - 1])) {
          // 測定して収まるか確認
          const testText = text.substring(0, i)
          const measurement = this.measureText(testText)
          if (!measurement.overflow) {
            return i
          }
        }
      }
      // 収まらない場合は元の位置から1文字戻す
      return Math.max(0, position - 1)
    }

    return position
  }

  /**
   * チャプター内のブロックを連結してページ分割
   */
  private processChapter(chapter: Chapter): Page[] {
    const chapterPages: Page[] = []
    let pageId = this.pages.length + 1
    let currentBlockIndex = 0
    let currentCharOffset = 0

    // チャプター内の全ブロックを処理
    while (currentBlockIndex < chapter.blocks.length) {
      const pageContent: string[] = []
      const pageBreakPoints: PageBreakPoint[] = []
      let remainingSpace = true

      // 1ページに収まるだけのブロックを追加
      while (currentBlockIndex < chapter.blocks.length && remainingSpace) {
        const block = chapter.blocks[currentBlockIndex]
        const remainingText = block.text.substring(currentCharOffset)

        if (remainingText.length === 0) {
          // このブロックは完了、次へ
          currentBlockIndex++
          currentCharOffset = 0
          continue
        }

        // 現在のページに追加済みのテキスト
        const currentPageText = pageContent.join('')

        // ブロックの開始時（ブロックの最初の文字を処理する時）にインデントを追加
        let textToAdd = remainingText
        const isBlockStart = currentCharOffset === 0
        if (isBlockStart && block.type === 'paragraph') {
          textToAdd = '　' + remainingText // 全角スペースでインデント
        }

        // 新しいブロックの場合、前のブロックとの間に改行を追加
        const needsNewline = isBlockStart && pageContent.length > 0
        const connector = needsNewline ? '\n' : ''

        // このブロックの残りテキストを追加して測定
        const testText = currentPageText + connector + textToAdd
        const breakPoint = this.findOptimalBreakPoint(testText)

        // 追加できる文字数を計算
        const addedChars = breakPoint - currentPageText.length

        if (addedChars <= 0 && pageContent.length === 0) {
          // 最低1文字は進める
          let contentToAdd = remainingText.substring(0, 1)
          if (isBlockStart && block.type === 'paragraph') {
            contentToAdd = '　' + contentToAdd
          }
          pageContent.push(contentToAdd)
          pageBreakPoints.push({
            chapterId: chapter.id,
            blockId: block.id,
            characterStart: currentCharOffset,
            characterEnd: currentCharOffset + 1
          })
          currentCharOffset += 1
          remainingSpace = false
        } else if (addedChars > 0) {
          // 部分的に追加
          // connectorの分を差し引く必要があるかどうか
          const connectorLength = needsNewline ? 1 : 0
          let effectiveAddedChars = addedChars - connectorLength

          const originalAddedChars = isBlockStart && block.type === 'paragraph' ? effectiveAddedChars - 1 : effectiveAddedChars
          let contentToAdd = remainingText.substring(0, Math.max(1, originalAddedChars))
          if (isBlockStart && block.type === 'paragraph') {
            contentToAdd = '　' + contentToAdd
          }

          // 改行が必要な場合は前に改行を追加
          if (needsNewline) {
            contentToAdd = '\n' + contentToAdd
          }

          pageContent.push(contentToAdd)
          pageBreakPoints.push({
            chapterId: chapter.id,
            blockId: block.id,
            characterStart: currentCharOffset,
            characterEnd: currentCharOffset + originalAddedChars
          })

          currentCharOffset += originalAddedChars

          // ブロックを使い切った場合
          if (currentCharOffset >= block.text.length) {
            currentBlockIndex++
            currentCharOffset = 0
          }

          // ページがいっぱいになった場合
          if (breakPoint < testText.length) {
            remainingSpace = false
          }
        } else {
          // もう追加できない
          remainingSpace = false
        }
      }

      // ページを作成
      if (pageContent.length > 0) {
        const totalCharacters = pageContent.join('').length
        chapterPages.push({
          id: pageId++,
          content: pageContent,
          position: {
            chapterId: chapter.id,
            blockId: pageBreakPoints[0]?.blockId || 0,
            characterStart: pageBreakPoints[0]?.characterStart || 0,
            characterEnd: pageBreakPoints[pageBreakPoints.length - 1]?.characterEnd || 0
          },
          totalCharacters
        })
      }
    }

    return chapterPages
  }

  /**
   * 全ページを計算
   */
  private calculatePages(): void {
    this.pages = []
    this.totalCharacters = 0

    // 各チャプターを処理
    for (const chapter of this.bookContent.chapters) {
      // チャプターの総文字数を計算
      const chapterCharCount = chapter.blocks.reduce(
        (sum, block) => sum + block.text.length,
        0
      )
      this.totalCharacters += chapterCharCount

      // チャプターをページに分割
      const chapterPages = this.processChapter(chapter)
      this.pages.push(...chapterPages)
    }
  }

  /**
   * ページネーション状態を取得
   */
  getPaginationState(currentPageIndex: number = 0): PaginationState {
    return {
      currentPageIndex,
      totalPages: this.pages.length,
      pages: this.pages,
      containerWidth: this.context.width,
      containerHeight: this.context.height,
      fontSize: parseInt(this.context.fontSize),
      lineHeight: this.context.lineHeight,
      charactersPerLine: 0, // DOM測定では不要
      linesPerPage: 0       // DOM測定では不要
    }
  }

  /**
   * 特定ページのコンテンツを取得
   */
  getPageContent(pageIndex: number): Page | null {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return null
    }
    return this.pages[pageIndex]
  }

  /**
   * 次のページが存在するか
   */
  hasNextPage(currentIndex: number): boolean {
    return currentIndex < this.pages.length - 1
  }

  /**
   * 前のページが存在するか
   */
  hasPreviousPage(currentIndex: number): boolean {
    return currentIndex > 0
  }

  /**
   * チャプターの開始ページを取得
   */
  getChapterStartPage(chapterId: number): number {
    const pageIndex = this.pages.findIndex(
      page => page.position.chapterId === chapterId
    )
    return pageIndex >= 0 ? pageIndex : 0
  }

  /**
   * 特定位置のページを検索
   */
  findPageByPosition(
    chapterId: number,
    blockId: number,
    characterPosition: number = 0
  ): number {
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i]
      if (page.position.chapterId === chapterId) {
        // ブロックIDと文字位置をチェック
        if (page.position.blockId === blockId) {
          if (characterPosition >= page.position.characterStart &&
              characterPosition <= page.position.characterEnd) {
            return i
          }
        }
      }
    }
    return 0
  }

  /**
   * サマリ情報を取得
   */
  getSummary() {
    const chaptersInfo = this.bookContent.chapters.map(chapter => {
      const startPage = this.getChapterStartPage(chapter.id)
      const endPage = this.pages.findIndex(
        (page, index) =>
          index > startPage &&
          page.position.chapterId !== chapter.id
      )

      return {
        chapterId: chapter.id,
        title: chapter.title,
        startPage: startPage + 1,
        pageCount: endPage === -1
          ? this.pages.length - startPage
          : endPage - startPage
      }
    })

    return {
      totalPages: this.pages.length,
      totalCharacters: this.totalCharacters,
      averageCharactersPerPage: Math.round(
        this.totalCharacters / Math.max(1, this.pages.length)
      ),
      chaptersInfo
    }
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    if (this.measurementContainer?.parentNode) {
      this.measurementContainer.parentNode.removeChild(this.measurementContainer)
    }
    this.measurementContainer = null
    this.textContainer = null
    this.pages = []
  }
}