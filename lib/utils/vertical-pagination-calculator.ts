interface Page {
  id: string
  content: string
  chapterTitle?: string
}

interface TextBlock {
  id: string
  type: 'paragraph' | 'conversation' | 'chapter'
  content: string
  chapterTitle?: string
}

interface PaginationConfig {
  containerHeight: number  // 固定の縦幅
  maxContainerWidth: number  // 最大横幅
  fontSize: number
  lineHeight: number
  fontFamily: string
  letterSpacing: string
}

export class VerticalPaginationCalculator {
  private config: PaginationConfig
  private measurementContainer: HTMLDivElement | null = null
  private measuredMaxWidth: number = 0

  constructor(config: PaginationConfig) {
    this.config = config
  }

  /**
   * Step 1: 空状態でのサイズ計測
   * 実際の表示エリアにコンポーネントを配置して最大幅を計測
   */
  public async measureDisplayArea(): Promise<number> {
    console.log('📏 Step 1: 表示エリアの計測開始')

    // 測定用コンテナを画面内に配置
    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: ${this.config.containerHeight}px;
      max-width: ${this.config.maxContainerWidth}px;
      padding: 24px;
      box-sizing: border-box;
      background: white;
      z-index: 9999;
    `

    const textArea = document.createElement('div')
    textArea.style.cssText = `
      height: 100%;
      width: auto;
      font-size: ${this.config.fontSize}px;
      line-height: ${this.config.lineHeight};
      font-family: ${this.config.fontFamily};
      letter-spacing: ${this.config.letterSpacing};
      writing-mode: vertical-rl;
      -webkit-writing-mode: vertical-rl;
      -ms-writing-mode: tb-rl;
      text-orientation: mixed;
      -webkit-text-orientation: mixed;
      direction: ltr;
      overflow: visible;
    `

    // サンプルテキストで幅を計測
    textArea.textContent = '　　吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。'

    container.appendChild(textArea)
    document.body.appendChild(container)

    // レンダリング完了を待つ
    await new Promise(resolve => requestAnimationFrame(resolve))

    const rect = container.getBoundingClientRect()
    this.measuredMaxWidth = rect.width - 48 // paddingを除く

    console.log(`📐 計測完了: 最大幅 = ${this.measuredMaxWidth}px`)

    // 測定用コンテナを非表示に
    container.style.visibility = 'hidden'
    container.style.left = '-9999px'

    return this.measuredMaxWidth
  }

  /**
   * Step 2: 仮想配置による1ページ分のテキスト計算
   * 横幅可変、縦幅固定で配置してテキストを流し込む
   */
  private async createMeasurementDOM(): Promise<void> {
    if (this.measurementContainer) return

    console.log('🔧 Step 2: 測定DOM作成')

    this.measurementContainer = document.createElement('div')
    this.measurementContainer.style.cssText = `
      position: absolute;
      visibility: hidden;
      left: -9999px;
      top: -9999px;
      height: ${this.config.containerHeight}px;
      width: auto;
      max-width: ${this.measuredMaxWidth}px;
      box-sizing: border-box;
      font-size: ${this.config.fontSize}px;
      line-height: ${this.config.lineHeight};
      font-family: ${this.config.fontFamily};
      letter-spacing: ${this.config.letterSpacing};
      writing-mode: vertical-rl;
      -webkit-writing-mode: vertical-rl;
      -ms-writing-mode: tb-rl;
      text-orientation: mixed;
      -webkit-text-orientation: mixed;
      direction: ltr;
      overflow: visible;
      white-space: pre-wrap;
      word-break: normal;
      overflow-wrap: break-word;
    `

    document.body.appendChild(this.measurementContainer)
  }

  /**
   * テキストが収まるかチェックし、収まる最大文字数を返す
   */
  private async findFittingText(text: string): Promise<string> {
    if (!this.measurementContainer) throw new Error('測定DOMが初期化されていません')

    console.log(`🔍 テキストフィッティング開始: ${text.substring(0, 30)}...`)

    let left = 0
    let right = text.length
    let result = ''

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const testText = text.substring(0, mid)

      this.measurementContainer.textContent = testText

      // レンダリング完了を待つ
      await new Promise(resolve => requestAnimationFrame(resolve))

      const scrollWidth = this.measurementContainer.scrollWidth

      console.log(`  テスト: 文字数=${mid}, 幅=${scrollWidth}/${this.measuredMaxWidth}`)

      if (scrollWidth <= this.measuredMaxWidth) {
        result = testText
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    console.log(`  ✅ フィッティング完了: ${result.length}文字`)
    return result
  }

  /**
   * Step 3: 全ページのコンテンツを計算
   */
  public async calculatePages(blocks: TextBlock[]): Promise<Page[]> {
    if (!this.measuredMaxWidth) {
      await this.measureDisplayArea()
    }

    await this.createMeasurementDOM()

    console.log('📖 Step 3: ページ計算開始')
    console.log(`  ブロック数: ${blocks.length}`)

    const pages: Page[] = []
    let currentPageContent = ''
    let currentPageId = `page-${Date.now()}`
    let currentChapterTitle: string | undefined

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      console.log(`\n  処理中: ${block.id} (${block.type})`)

      // 章の開始
      if (block.type === 'chapter') {
        // 現在のページを保存
        if (currentPageContent) {
          pages.push({
            id: currentPageId,
            content: currentPageContent,
            chapterTitle: currentChapterTitle
          })
          console.log(`    → ページ${pages.length}保存: ${currentPageContent.substring(0, 30)}...`)
          currentPageContent = ''
          currentPageId = `page-${Date.now()}-${Math.random()}`
        }
        currentChapterTitle = block.chapterTitle
        continue
      }

      // テキストコンテンツの処理
      const blockContent = block.type === 'paragraph'
        ? `　　${block.content}`  // 段落は字下げ
        : block.content

      const testContent = currentPageContent + blockContent

      // テストしてみる
      this.measurementContainer!.textContent = testContent
      await new Promise(resolve => requestAnimationFrame(resolve))

      const scrollWidth = this.measurementContainer!.scrollWidth

      if (scrollWidth > this.measuredMaxWidth && currentPageContent) {
        // オーバーフロー: 現在のページを保存して新しいページを開始
        pages.push({
          id: currentPageId,
          content: currentPageContent,
          chapterTitle: currentChapterTitle
        })
        console.log(`    → ページ${pages.length}保存 (オーバーフロー)`)

        currentPageContent = ''
        currentPageId = `page-${Date.now()}-${Math.random()}`
        currentChapterTitle = undefined

        // 新しいページでブロックを追加
        const fittingText = await this.findFittingText(blockContent)
        if (fittingText.length < blockContent.length) {
          // ブロックが1ページに収まらない場合は分割
          currentPageContent = fittingText
          pages.push({
            id: currentPageId,
            content: currentPageContent,
            chapterTitle: currentChapterTitle
          })
          console.log(`    → ページ${pages.length}保存 (分割)`)

          // 残りを次のページに
          const remainingText = blockContent.substring(fittingText.length)
          currentPageContent = remainingText
          currentPageId = `page-${Date.now()}-${Math.random()}`
          currentChapterTitle = undefined
        } else {
          currentPageContent = blockContent
        }
      } else {
        // 収まる場合はそのまま追加
        currentPageContent = testContent
        console.log(`    追加OK: 幅=${scrollWidth}/${this.measuredMaxWidth}`)
      }
    }

    // 最後のページを保存
    if (currentPageContent) {
      pages.push({
        id: currentPageId,
        content: currentPageContent,
        chapterTitle: currentChapterTitle
      })
      console.log(`    → 最終ページ${pages.length}保存`)
    }

    console.log(`\n✅ ページ計算完了: 全${pages.length}ページ`)
    return pages
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    if (this.measurementContainer && this.measurementContainer.parentNode) {
      this.measurementContainer.parentNode.removeChild(this.measurementContainer)
      this.measurementContainer = null
    }
  }
}

/**
 * 書籍コンテンツをブロックに分解
 */
export function parseBookContent(content: string): TextBlock[] {
  console.log('📚 書籍コンテンツ解析')

  const lines = content.split('\n')
  const blocks: TextBlock[] = []
  let currentBlock = ''
  let blockId = 0

  for (const line of lines) {
    if (line.trim() === '') {
      if (currentBlock) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'paragraph',
          content: currentBlock.trim()
        })
        currentBlock = ''
      }
    } else if (line.match(/^第[一二三四五六七八九十\d]+章/)) {
      if (currentBlock) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'paragraph',
          content: currentBlock.trim()
        })
        currentBlock = ''
      }
      blocks.push({
        id: `chapter-${blockId++}`,
        type: 'chapter',
        content: '',
        chapterTitle: line.trim()
      })
    } else if (line.startsWith('「') || line.startsWith('『')) {
      if (currentBlock) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'paragraph',
          content: currentBlock.trim()
        })
        currentBlock = ''
      }
      blocks.push({
        id: `conversation-${blockId++}`,
        type: 'conversation',
        content: line.trim()
      })
    } else {
      currentBlock += (currentBlock ? '' : '') + line
    }
  }

  if (currentBlock) {
    blocks.push({
      id: `block-${blockId++}`,
      type: 'paragraph',
      content: currentBlock.trim()
    })
  }

  console.log(`  → ${blocks.length}個のブロックに分割`)
  return blocks
}

export type { Page, TextBlock }