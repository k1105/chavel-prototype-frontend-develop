import type { BookContent, Page, PaginationState } from '@/types/pagination'

export class SimplePaginationCalculator {
  private bookContent: BookContent
  private pages: Page[] = []

  constructor(bookContent: BookContent) {
    this.bookContent = bookContent
    this.calculateSimplePages()
  }

  private calculateSimplePages(): void {
    this.pages = []
    let pageId = 1

    // シンプルに: 各チャプターの最初の数ブロックを1ページとする
    for (const chapter of this.bookContent.chapters) {
      if (chapter.blocks.length === 0) continue

      // チャプターの最初の3ブロックを結合して1ページにする
      const blocksToShow = chapter.blocks.slice(0, 3)
      const content = blocksToShow.map((b) => b.text)
      const totalChars = content.join('').length

      this.pages.push({
        id: pageId++,
        position: {
          chapterId: chapter.id,
          blockId: chapter.blocks[0].id,
          characterStart: 0,
          characterEnd: totalChars,
        },
        content,
        totalCharacters: totalChars,
      })

      // 残りのブロックも同様に処理（3ブロックずつ）
      for (let i = 3; i < chapter.blocks.length; i += 3) {
        const nextBlocks = chapter.blocks.slice(i, i + 3)
        const nextContent = nextBlocks.map((b) => b.text)
        const nextTotalChars = nextContent.join('').length

        this.pages.push({
          id: pageId++,
          position: {
            chapterId: chapter.id,
            blockId: nextBlocks[0].id,
            characterStart: 0,
            characterEnd: nextTotalChars,
          },
          content: nextContent,
          totalCharacters: nextTotalChars,
        })
      }
    }

    // 最低1ページは作成
    if (this.pages.length === 0) {
      this.pages.push({
        id: 1,
        position: {
          chapterId: 1,
          blockId: 1,
          characterStart: 0,
          characterEnd: 0,
        },
        content: ['データがありません'],
        totalCharacters: 8,
      })
    }

    console.log(`SimplePaginationCalculator: Generated ${this.pages.length} pages`)
  }

  getPaginationState(currentPageIndex = 0): PaginationState {
    return {
      currentPageIndex: Math.max(0, Math.min(currentPageIndex, this.pages.length - 1)),
      totalPages: this.pages.length,
      pages: this.pages,
      containerWidth: 800,
      containerHeight: 600,
      fontSize: 16,
      lineHeight: 1.6,
      charactersPerLine: 50,
      linesPerPage: 20,
    }
  }

  getPageContent(pageIndex: number): Page | null {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return null
    }
    return this.pages[pageIndex]
  }

  hasNextPage(currentPageIndex: number): boolean {
    return currentPageIndex < this.pages.length - 1
  }

  hasPreviousPage(currentPageIndex: number): boolean {
    return currentPageIndex > 0
  }

  getChapterStartPage(chapterId: number): number {
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pages[i].position.chapterId === chapterId) {
        return i
      }
    }
    return 0
  }

  findPageByPosition(chapterId: number, blockId: number, _characterPosition = 0): number {
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i]
      if (page.position.chapterId === chapterId && page.position.blockId === blockId) {
        return i
      }
    }
    return 0
  }

  getSummary(): any {
    return {
      totalPages: this.pages.length,
      totalCharacters: this.pages.reduce((sum, p) => sum + p.totalCharacters, 0),
      averageCharactersPerPage:
        this.pages.length > 0
          ? this.pages.reduce((sum, p) => sum + p.totalCharacters, 0) / this.pages.length
          : 0,
      chaptersInfo: [],
    }
  }

  dispose(): void {
    // クリーンアップ不要
  }
}
