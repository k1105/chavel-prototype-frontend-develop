/**
 * コンテンツ位置探索の汎用ユーティリティ
 * ブロックID、チャプターID、テキスト内容などから該当ページを特定
 */

import type { ContentPosition } from './reading-state'

export interface PageData {
  id: string
  content: string
  chapterTitle?: string
  isChapterStart?: boolean
  isChapterEnd?: boolean
  metadata?: {
    chapterId: number
    blockIds: number[]
    startBlockId?: number
    endBlockId?: number
    endBlockCharacterOffset?: number
    characterRange?: {
      start: number
      end: number
    }
  }
}

export interface BookData {
  metadata: {
    id: number
    title: string
    author: string
  }
  content: {
    chapters: Array<{
      id: number
      title: string
      blocks: Array<{
        id: number
        type: string
        text: string
      }>
    }>
  }
}

export interface FindResult {
  pageIndex: number
  page: PageData
  exactMatch: boolean
}

/**
 * ブロックIDから該当ページを特定
 */
export function findPageByBlockId(
  pages: PageData[],
  targetBlockId: number
): FindResult | null {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (page.metadata?.blockIds?.includes(targetBlockId)) {
      return {
        pageIndex: i,
        page,
        exactMatch: true
      }
    }
  }
  return null
}

/**
 * チャプターIDから開始ページを特定
 */
export function findPageByChapterId(
  pages: PageData[],
  targetChapterId: number
): FindResult | null {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (page.metadata?.chapterId === targetChapterId && page.isChapterStart) {
      return {
        pageIndex: i,
        page,
        exactMatch: true
      }
    }
  }
  return null
}

/**
 * テキスト内容から該当ページを探索（部分一致）
 */
export function findPageByTextContent(
  pages: PageData[],
  searchText: string,
  options: {
    caseSensitive?: boolean
    exactMatch?: boolean
  } = {}
): FindResult[] {
  const { caseSensitive = false, exactMatch = false } = options
  const results: FindResult[] = []

  const normalizeText = (text: string) =>
    caseSensitive ? text : text.toLowerCase()

  const normalizedSearch = normalizeText(searchText)

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const normalizedContent = normalizeText(page.content)

    const isMatch = exactMatch
      ? normalizedContent === normalizedSearch
      : normalizedContent.includes(normalizedSearch)

    if (isMatch) {
      results.push({
        pageIndex: i,
        page,
        exactMatch: exactMatch ? true : normalizedContent === normalizedSearch
      })
    }
  }

  return results
}

/**
 * ページからチャプター・ブロック位置を逆算
 */
export function getContentPositionFromPage(
  page: PageData,
  characterOffset: number = 0
): ContentPosition | null {
  if (!page.metadata?.chapterId || !page.metadata?.blockIds?.[0]) {
    return null
  }

  // 文字オフセットが範囲外の場合は調整
  const adjustedOffset = Math.max(
    0,
    Math.min(characterOffset, page.content.length - 1)
  )

  return {
    chapterId: page.metadata.chapterId,
    blockId: page.metadata.startBlockId || page.metadata.blockIds[0],
    characterOffset: adjustedOffset
  }
}

/**
 * 位置情報から最も近いページを特定
 */
export function findNearestPageToPosition(
  pages: PageData[],
  position: ContentPosition
): FindResult | null {
  // まずブロックIDで完全一致を探す
  const exactMatch = findPageByBlockId(pages, position.blockId)
  if (exactMatch) {
    return exactMatch
  }

  // 次にチャプターID一致のページを探す
  const chapterMatches = pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => page.metadata?.chapterId === position.chapterId)

  if (chapterMatches.length === 0) {
    return null
  }

  // チャプター内で最も近いブロックIDを持つページを探す
  let bestMatch = chapterMatches[0]
  let bestDistance = Number.MAX_VALUE

  for (const { page, index } of chapterMatches) {
    if (!page.metadata?.blockIds) continue

    for (const blockId of page.metadata.blockIds) {
      const distance = Math.abs(blockId - position.blockId)
      if (distance < bestDistance) {
        bestDistance = distance
        bestMatch = { page, index }
      }
    }
  }

  return {
    pageIndex: bestMatch.index,
    page: bestMatch.page,
    exactMatch: false
  }
}

/**
 * 書籍データからページ配列を作成する際に、各ページにメタデータを付与
 */
export function enrichPageWithMetadata(
  pageContent: string,
  chapterTitle: string | undefined,
  chapterId: number,
  blockIds: number[],
  isChapterStart: boolean = false,
  isChapterEnd: boolean = false,
  endBlockCharacterOffset?: number
): Omit<PageData, 'id'> {
  return {
    content: pageContent,
    chapterTitle,
    isChapterStart,
    isChapterEnd,
    metadata: {
      chapterId,
      blockIds,
      startBlockId: blockIds[0],
      endBlockId: blockIds[blockIds.length - 1],
      endBlockCharacterOffset,
      characterRange: {
        start: 0,
        end: pageContent.length - 1
      }
    }
  }
}

/**
 * ブロックIDの範囲から該当するページ範囲を特定
 */
export function findPageRangeByBlockRange(
  pages: PageData[],
  startBlockId: number,
  endBlockId: number
): { startPageIndex: number; endPageIndex: number } | null {
  let startPageIndex = -1
  let endPageIndex = -1

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (!page.metadata?.blockIds) continue

    // 開始ブロックを含むページ
    if (startPageIndex === -1 && page.metadata.blockIds.includes(startBlockId)) {
      startPageIndex = i
    }

    // 終了ブロックを含むページ
    if (page.metadata.blockIds.includes(endBlockId)) {
      endPageIndex = i
    }

    // 両方見つかったら終了
    if (startPageIndex !== -1 && endPageIndex !== -1) {
      break
    }
  }

  if (startPageIndex === -1 || endPageIndex === -1) {
    return null
  }

  return { startPageIndex, endPageIndex }
}

/**
 * 進行度（0-1）から該当ページを概算
 */
export function findPageByProgress(
  pages: PageData[],
  progress: number
): FindResult | null {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const targetPageIndex = Math.floor((pages.length - 1) * clampedProgress)

  if (targetPageIndex < 0 || targetPageIndex >= pages.length) {
    return null
  }

  return {
    pageIndex: targetPageIndex,
    page: pages[targetPageIndex],
    exactMatch: false
  }
}

/**
 * デバッグ用: ページの位置情報を文字列として表示
 */
export function debugPagePosition(page: PageData): string {
  if (!page.metadata) {
    return 'No metadata'
  }

  const { chapterId, blockIds, startBlockId, endBlockId } = page.metadata
  return `Chapter ${chapterId}, Blocks ${startBlockId}-${endBlockId} (${blockIds.length} blocks)`
}