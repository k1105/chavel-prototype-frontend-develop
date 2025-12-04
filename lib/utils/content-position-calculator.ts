import type { BookContent } from '@/types/pagination'

export interface PagePositionData {
  pageIndex: number
  chapterId: number
  blockId: number
  pageStartPosition: number
  pageEndPosition: number
  pageCharacterCount: number
}

export interface PositionCalculatorResult {
  totalCharacters: number
  pagePositions: PagePositionData[]
}

export class ContentPositionCalculator {
  private bookContent: BookContent
  private positionData: PositionCalculatorResult | null = null

  constructor(bookContent: BookContent) {
    this.bookContent = bookContent
    this.calculatePositions()
  }

  /**
   * 全ページの累積文字位置を事前計算
   */
  private calculatePositions(): void {
    const pagePositions: PagePositionData[] = []
    let cumulativePosition = 0
    let pageIndex = 0

    for (const chapter of this.bookContent.chapters) {
      for (const block of chapter.blocks) {
        const blockLength = block.text.length

        // このブロックが1ページに収まるかチェック
        // 簡単のため、ここでは各ブロック = 1ページとして扱う
        // 実際の実装では、PaginationCalculatorと連携する必要がある
        const pageData: PagePositionData = {
          pageIndex,
          chapterId: chapter.id,
          blockId: block.id,
          pageStartPosition: cumulativePosition,
          pageEndPosition: cumulativePosition + blockLength,
          pageCharacterCount: blockLength
        }

        pagePositions.push(pageData)
        cumulativePosition += blockLength
        pageIndex++
      }
    }

    this.positionData = {
      totalCharacters: cumulativePosition,
      pagePositions
    }
  }

  /**
   * 指定されたページインデックスの最後の文字位置を取得
   */
  getPageEndPosition(pageIndex: number): number {
    if (!this.positionData || pageIndex < 0 || pageIndex >= this.positionData.pagePositions.length) {
      return 0
    }

    return this.positionData.pagePositions[pageIndex].pageEndPosition
  }

  /**
   * 指定された累積文字位置が含まれるページを検索
   */
  findPageByPosition(position: number): PagePositionData | null {
    if (!this.positionData) return null

    for (const pageData of this.positionData.pagePositions) {
      if (position >= pageData.pageStartPosition && position < pageData.pageEndPosition) {
        return pageData
      }
    }

    // 最後のページを超えている場合は最後のページを返す
    if (this.positionData.pagePositions.length > 0) {
      return this.positionData.pagePositions[this.positionData.pagePositions.length - 1]
    }

    return null
  }

  /**
   * 指定されたページの位置情報を取得
   */
  getPagePositionData(pageIndex: number): PagePositionData | null {
    if (!this.positionData || pageIndex < 0 || pageIndex >= this.positionData.pagePositions.length) {
      return null
    }

    return this.positionData.pagePositions[pageIndex]
  }

  /**
   * 全ページ数を取得
   */
  getTotalPages(): number {
    return this.positionData?.pagePositions.length || 0
  }

  /**
   * 総文字数を取得
   */
  getTotalCharacters(): number {
    return this.positionData?.totalCharacters || 0
  }

  /**
   * 位置計算結果のサマリーを取得
   */
  getSummary(): {
    totalPages: number
    totalCharacters: number
    averageCharactersPerPage: number
    chapters: Array<{
      chapterId: number
      title: string
      startPageIndex: number
      endPageIndex: number
      characterCount: number
    }>
  } {
    if (!this.positionData) {
      return {
        totalPages: 0,
        totalCharacters: 0,
        averageCharactersPerPage: 0,
        chapters: []
      }
    }

    const chapters = this.bookContent.chapters.map(chapter => {
      const chapterPages = this.positionData!.pagePositions.filter(
        page => page.chapterId === chapter.id
      )

      const startPageIndex = chapterPages[0]?.pageIndex || 0
      const endPageIndex = chapterPages[chapterPages.length - 1]?.pageIndex || 0
      const characterCount = chapterPages.reduce(
        (sum, page) => sum + page.pageCharacterCount, 0
      )

      return {
        chapterId: chapter.id,
        title: chapter.title,
        startPageIndex,
        endPageIndex,
        characterCount
      }
    })

    return {
      totalPages: this.positionData.pagePositions.length,
      totalCharacters: this.positionData.totalCharacters,
      averageCharactersPerPage: this.positionData.totalCharacters / this.positionData.pagePositions.length,
      chapters
    }
  }

  /**
   * 書籍コンテンツが更新された時の再計算
   */
  updateBookContent(bookContent: BookContent): void {
    this.bookContent = bookContent
    this.calculatePositions()
  }
}