import type { BookContent, Page, PaginationState } from '@/types/pagination'
import { TextMeasurer } from './text-measurement'

export class PaginationCalculator {
  private textMeasurer: TextMeasurer
  private bookContent: BookContent
  private pages: Page[] = []

  constructor(
    bookContent: BookContent,
    containerWidth: number,
    containerHeight: number,
    fontSize = 16,
    lineHeight = 1.6,
  ) {
    this.bookContent = bookContent
    this.textMeasurer = new TextMeasurer(containerWidth, containerHeight, fontSize, lineHeight)
    this.calculatePages()
  }

  /**
   * 全ページを計算
   */
  private calculatePages(): void {
    this.pages = []
    let pageId = 1

    const capacity = this.textMeasurer.getPageCapacity()

    // 無効なコンテナサイズの場合はデフォルト値を使用
    const effectiveCapacity = capacity.totalCharacters > 0 ? capacity.totalCharacters : 1000

    for (const chapter of this.bookContent.chapters) {
      // チャプター開始時は新しいページを開始
      let currentPageContent: string[] = []
      let currentPageCharacterCount = 0
      let currentBlockStartIndex = 0

      for (let blockIndex = 0; blockIndex < chapter.blocks.length; blockIndex++) {
        const block = chapter.blocks[blockIndex]

        // ブロックのテキストを追加できるかチェック
        const tentativeContent = [...currentPageContent, block.text]
        const tentativeText = tentativeContent.join('')

        if (tentativeText.length <= effectiveCapacity) {
          // 現在のページに収まる場合は追加
          currentPageContent.push(block.text)
          currentPageCharacterCount += block.text.length
        } else {
          // 収まらない場合は現在のページを保存し、新しいページを開始
          if (currentPageContent.length > 0) {
            this.pages.push({
              id: pageId++,
              position: {
                chapterId: chapter.id,
                blockId: chapter.blocks[currentBlockStartIndex].id,
                characterStart: 0,
                characterEnd: currentPageCharacterCount,
              },
              content: currentPageContent,
              totalCharacters: currentPageCharacterCount,
            })
          }

          // 新しいページを開始
          currentPageContent = [block.text]
          currentPageCharacterCount = block.text.length
          currentBlockStartIndex = blockIndex

          // もし1つのブロックでもページ容量を超える場合は分割が必要
          if (block.text.length > effectiveCapacity) {
            // 大きなブロックを分割
            this.splitLargeBlock(chapter, block, { totalCharacters: effectiveCapacity }, pageId)
            pageId = this.pages.length + 1
            currentPageContent = []
            currentPageCharacterCount = 0
          }
        }
      }

      // チャプター終了時に残りのコンテンツがあればページとして保存
      if (currentPageContent.length > 0) {
        this.pages.push({
          id: pageId++,
          position: {
            chapterId: chapter.id,
            blockId: chapter.blocks[currentBlockStartIndex].id,
            characterStart: 0,
            characterEnd: currentPageCharacterCount,
          },
          content: currentPageContent,
          totalCharacters: currentPageCharacterCount,
        })
      }
    }

    console.log(`PaginationCalculator: Generated ${this.pages.length} pages`)
  }

  /**
   * 大きなブロックを複数ページに分割
   */
  private splitLargeBlock(
    chapter: any,
    block: any,
    _capacity: { totalCharacters: number },
    startPageId: number,
  ): void {
    let remainingText = block.text
    let characterStart = 0
    let pageId = startPageId

    while (remainingText.length > 0) {
      const { fittedText, remainingText: nextRemaining } =
        this.textMeasurer.fitTextToPage(remainingText)

      if (fittedText.length === 0) {
        // 安全装置: 1文字も入らない場合は強制的に1文字入れる
        const forcedText = remainingText.charAt(0)
        this.pages.push({
          id: pageId++,
          position: {
            chapterId: chapter.id,
            blockId: block.id,
            characterStart,
            characterEnd: characterStart + 1,
          },
          content: [forcedText],
          totalCharacters: 1,
        })
        remainingText = remainingText.substring(1)
        characterStart += 1
      } else {
        this.pages.push({
          id: pageId++,
          position: {
            chapterId: chapter.id,
            blockId: block.id,
            characterStart,
            characterEnd: characterStart + fittedText.length,
          },
          content: [fittedText],
          totalCharacters: fittedText.length,
        })
        remainingText = nextRemaining
        characterStart += fittedText.length
      }
    }
  }

  /**
   * 現在のページネーション状態を取得
   */
  getPaginationState(currentPageIndex = 0): PaginationState {
    const capacity = this.textMeasurer.getPageCapacity()

    return {
      currentPageIndex: Math.max(0, Math.min(currentPageIndex, this.pages.length - 1)),
      totalPages: this.pages.length,
      pages: this.pages,
      containerWidth: this.textMeasurer.getContainerWidth,
      containerHeight: this.textMeasurer.getContainerHeight,
      fontSize: this.textMeasurer.getFontSize,
      lineHeight: this.textMeasurer.getLineHeight,
      charactersPerLine: capacity.charactersPerLine,
      linesPerPage: capacity.linesPerPage,
    }
  }

  /**
   * 指定されたページの内容を取得
   */
  getPageContent(pageIndex: number): Page | null {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return null
    }
    return this.pages[pageIndex]
  }

  /**
   * 指定された章・ブロック・文字位置から該当するページを検索
   */
  findPageByPosition(chapterId: number, blockId: number, characterPosition = 0): number {
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i]
      const pos = page.position

      if (
        pos.chapterId === chapterId &&
        pos.blockId === blockId &&
        characterPosition >= pos.characterStart &&
        characterPosition < pos.characterEnd
      ) {
        return i
      }
    }
    return 0
  }

  /**
   * 章の開始ページを取得
   */
  getChapterStartPage(chapterId: number): number {
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pages[i].position.chapterId === chapterId) {
        return i
      }
    }
    return 0
  }

  /**
   * 次のページが存在するかチェック
   */
  hasNextPage(currentPageIndex: number): boolean {
    return currentPageIndex < this.pages.length - 1
  }

  /**
   * 前のページが存在するかチェック
   */
  hasPreviousPage(currentPageIndex: number): boolean {
    return currentPageIndex > 0
  }

  /**
   * 設定を更新してページを再計算
   */
  updateSettings(settings: {
    containerWidth?: number
    containerHeight?: number
    fontSize?: number
    lineHeight?: number
  }): void {
    this.textMeasurer.updateSettings(settings)
    this.calculatePages()
  }

  /**
   * ページネーション情報のサマリーを取得
   */
  getSummary(): {
    totalPages: number
    totalCharacters: number
    averageCharactersPerPage: number
    chaptersInfo: Array<{ chapterId: number; title: string; startPage: number; pageCount: number }>
  } {
    const totalCharacters = this.bookContent.chapters
      .flatMap((chapter) => chapter.blocks)
      .reduce((sum, block) => sum + block.text.length, 0)

    const chaptersInfo = this.bookContent.chapters.map((chapter) => {
      const chapterPages = this.pages.filter((page) => page.position.chapterId === chapter.id)
      const startPage = this.getChapterStartPage(chapter.id)

      return {
        chapterId: chapter.id,
        title: chapter.title,
        startPage,
        pageCount: chapterPages.length,
      }
    })

    return {
      totalPages: this.pages.length,
      totalCharacters,
      averageCharactersPerPage: totalCharacters / this.pages.length,
      chaptersInfo,
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.textMeasurer.dispose()
  }
}
