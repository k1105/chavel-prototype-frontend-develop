'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type PageData,
  type BookData as BookDataType,
  enrichPageWithMetadata,
  findNearestPageToPosition
} from '@/lib/utils/content-position-finder'
import type { ContentPosition } from '@/lib/utils/reading-state'
import type { BookData } from '@/types/book'

export interface Page {
  id: string
  content: string
  chapterTitle?: string
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

interface TextBlock {
  id: string
  type: 'paragraph' | 'conversation' | 'chapter'
  content: string
  chapterTitle?: string
}


interface UseVerticalTextPaginationOptions {
  bookData: BookData
  containerHeight: number
  maxWidth: number
  fontSize: number
  lineHeight: number
  initialPosition?: ContentPosition
  onPositionRestored?: (pageIndex: number) => void
}

export function useVerticalTextPagination({
  bookData,
  containerHeight,
  maxWidth,
  fontSize,
  lineHeight,
  initialPosition,
  onPositionRestored
}: UseVerticalTextPaginationOptions) {
  const [pages, setPages] = useState<Page[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [restoredPageIndex, setRestoredPageIndex] = useState<number | null>(null)
  const hasTriedPositionRestore = useRef(false)

  // 測定用DOMを再利用
  const measurementDivRef = useRef<HTMLDivElement | null>(null)

  const getMeasurementDiv = useCallback(() => {
    if (!measurementDivRef.current ||
        measurementDivRef.current.style.height !== `${containerHeight}px` ||
        measurementDivRef.current.style.fontSize !== `${fontSize}px`) {

      // 既存の要素があれば削除
      if (measurementDivRef.current) {
        document.body.removeChild(measurementDivRef.current)
      }

      const div = document.createElement('div')
      div.style.cssText = `
        position: absolute;
        visibility: hidden;
        left: -9999px;
        height: ${containerHeight}px;
        font-size: ${fontSize}px;
        line-height: ${lineHeight};
        font-family: Noto Sans JP, sans-serif;
        letter-spacing: 0.1em;
        writing-mode: vertical-rl;
        -webkit-writing-mode: vertical-rl;
        text-orientation: mixed;
        white-space: pre-wrap;
        word-break: normal;
      `
      document.body.appendChild(div)
      measurementDivRef.current = div
    }
    return measurementDivRef.current
  }, [containerHeight, fontSize, lineHeight])

  // 統一された測定関数
  const measureTextWidth = useCallback((content: string): number => {
    const measureDiv = getMeasurementDiv()
    measureDiv.textContent = content
    return measureDiv.scrollWidth
  }, [getMeasurementDiv])

  // JSONデータから構造化されたブロック配列を取得
  const getStructuredBlocks = useCallback((): TextBlock[] => {
    const blocks: TextBlock[] = []

    bookData.content.chapters.forEach(chapter => {
      // 章タイトルをブロックとして追加
      blocks.push({
        id: `chapter-${chapter.id}`,
        type: 'chapter',
        content: '',
        chapterTitle: chapter.title
      })

      // 章内のブロックを追加
      chapter.blocks.forEach(block => {
        blocks.push({
          id: `block-${chapter.id}-${block.id}`,
          type: block.type as 'paragraph' | 'conversation',
          content: block.text,
          chapterTitle: chapter.title
        })
      })
    })

    return blocks
  }, [bookData])

  // テキストが収まる量を計算（二分探索）+ 禁則処理
  const findFittingText = useCallback(async (
    text: string,
    maxWidth: number,
    baseContent = '',
    separator = ''
  ): Promise<string> => {
    let left = 0
    let right = text.length
    let result = ''

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const testText = text.substring(0, mid)
      const fullTestContent = baseContent + separator + testText

      const width = measureTextWidth(fullTestContent)

      if (width <= maxWidth) {
        result = testText
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // 禁則処理：次の文字が句読点の場合、最後の文字を次のページに送る
    if (result.length > 0 && result.length < text.length) {
      const nextChar = text[result.length]
      // 次の文字が句読点（。、）や閉じ括弧の場合
      if (nextChar === '。' || nextChar === '、' || nextChar === '」' || nextChar === '』' || nextChar === '）' || nextChar === '】') {
        // 最後の1文字を次のページに送る（ただし、result が1文字以上の場合）
        if (result.length > 1) {
          result = result.slice(0, -1)
        }
      }
    }

    return result
  }, [measureTextWidth])

  // 実際の表示エリアサイズを測定
  const measureActualDisplayArea = useCallback((): number => {
    // 実際のコンテナ要素を探す（デバッグページの表示エリア）
    const container = document.querySelector('[style*="maxWidth"]') as HTMLElement

    if (container) {
      const rect = container.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(container)
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0
      const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0
      const borderRight = parseFloat(computedStyle.borderRightWidth) || 0

      const availableWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight

      console.log('実際の測定:', {
        containerWidth: rect.width,
        padding: paddingLeft + paddingRight,
        border: borderLeft + borderRight,
        availableWidth
      })

      return availableWidth
    }

    // フォールバック: 設定値からパディング分を引く
    return maxWidth - 32 // デフォルトパディング 16px * 2
  }, [maxWidth])

  // ページネーション計算
  const calculatePagination = useCallback(async () => {
    setIsCalculating(true)
    setError(null)
    setProgress({ current: 0, total: 0 })

    try {
      const structuredBlocks = getStructuredBlocks()

      if (structuredBlocks.length === 0) {
        throw new Error('書籍データがありません')
      }

      // 実際の表示エリア幅を測定
      const actualMaxWidth = measureActualDisplayArea()

      setProgress({ current: 0, total: structuredBlocks.length })

      const calculatedPages: Page[] = []
      let currentPageContent = ''
      let currentPageId = `page-${Date.now()}`
      let currentChapterTitle: string | undefined
      let currentChapterId = 1
      let currentBlockIds: number[] = []

      // 最後のブロックの累積文字数を追跡
      let lastBlockCharacterOffset = 0
      const blockTexts = new Map<number, string>() // ブロックIDとテキストのマップ
      let currentBlockProcessedLength = 0 // 現在のブロックで既に処理された文字数

      for (let i = 0; i < structuredBlocks.length; i++) {
        const block = structuredBlocks[i]

        // 進捗更新
        if (i === 0 || i % 10 === 0) {
          setProgress({ current: i, total: structuredBlocks.length })
          // ブラウザの描画サイクルに同期してプログレスバーを表示
          await new Promise(resolve => requestAnimationFrame(resolve))
        }

        // 章の開始
        if (block.type === 'chapter') {
          if (currentPageContent) {
            const pageData = enrichPageWithMetadata(
              currentPageContent,
              currentChapterTitle,
              currentChapterId,
              currentBlockIds,
              false,
              true,
              lastBlockCharacterOffset
            )
            calculatedPages.push({
              id: currentPageId,
              content: pageData.content,
              chapterTitle: pageData.chapterTitle,
              isChapterEnd: pageData.isChapterEnd,
              metadata: pageData.metadata
            })
            currentPageContent = ''
            currentPageId = `page-${Date.now()}-${Math.random()}`
            currentBlockIds = []
          }
          currentChapterTitle = block.chapterTitle
          currentChapterId = parseInt(block.id.split('-')[1]) || currentChapterId + 1
          lastBlockCharacterOffset = 0 // 新しい章が始まるのでリセット
          continue
        }

        // テキストブロックの処理
        const blockId = parseInt(block.id.split('-')[2]) || 0

        // ブロックの元のテキストを保存（全角スペース除く）
        if (!blockTexts.has(blockId)) {
          blockTexts.set(blockId, block.content)
        }

        let blockContent = block.type === 'paragraph'
          ? `　${block.content}`
          : block.content

        const separator = currentPageContent ? '\n' : ''
        let testContent = currentPageContent + separator + blockContent

        let width = measureTextWidth(testContent)

        // 現在のブロックIDを追跡
        if (!currentBlockIds.includes(blockId)) {
          currentBlockIds.push(blockId)
          // ブロックのテキストを保存
          blockTexts.set(blockId, block.content)
          // 新しいブロックが始まったので処理済み文字数をリセット
          currentBlockProcessedLength = 0
        }

        if (width > actualMaxWidth && currentPageContent) {
          // オーバーフロー処理
          const fittingPortion = await findFittingText(
            blockContent,
            actualMaxWidth,
            currentPageContent,
            separator
          )

          if (fittingPortion.length > 0) {
            const pageWithFittingPortion = currentPageContent + separator + fittingPortion
            // 部分的にブロックが含まれる場合、その部分の長さを計算
            // fittingPortionから全角スペースを除去した長さを加算
            const fittingPortionLength = fittingPortion.replace(/　/g, '').length
            currentBlockProcessedLength += fittingPortionLength
            const pageData = enrichPageWithMetadata(
              pageWithFittingPortion,
              currentChapterTitle,
              currentChapterId,
              [...currentBlockIds],
              false,
              false,
              currentBlockProcessedLength
            )
            calculatedPages.push({
              id: currentPageId,
              content: pageData.content,
              chapterTitle: pageData.chapterTitle,
              metadata: pageData.metadata
            })

            let remainingContent = blockContent.substring(fittingPortion.length)
            currentPageContent = ''
            currentPageId = `page-${Date.now()}-${Math.random()}`
            currentBlockIds = [blockId]

            while (remainingContent.length > 0) {
              const remainingWidth = measureTextWidth(remainingContent)

              if (remainingWidth <= actualMaxWidth) {
                currentPageContent = remainingContent
                break
              } else {
                const nextFittingPortion = await findFittingText(remainingContent, actualMaxWidth)

                if (nextFittingPortion.length > 0) {
                  const nextPartialLength = nextFittingPortion.replace(/　/g, '').length
                  currentBlockProcessedLength += nextPartialLength
                  const pageData = enrichPageWithMetadata(
                    nextFittingPortion,
                    currentChapterTitle,
                    currentChapterId,
                    [blockId],
                    false,
                    false,
                    currentBlockProcessedLength
                  )
                  calculatedPages.push({
                    id: currentPageId,
                    content: pageData.content,
                    chapterTitle: pageData.chapterTitle,
                    metadata: pageData.metadata
                  })

                  remainingContent = remainingContent.substring(nextFittingPortion.length)
                  currentPageId = `page-${Date.now()}-${Math.random()}`
                } else {
                  break
                }
              }
            }
          } else {
            // ブロック全体がページに含まれる場合、ブロックの全長を設定
            const originalBlockText = blockTexts.get(blockId) || ''
            currentBlockProcessedLength = originalBlockText.length
            const pageData = enrichPageWithMetadata(
              currentPageContent,
              currentChapterTitle,
              currentChapterId,
              [...currentBlockIds],
              false,
              false,
              currentBlockProcessedLength
            )
            calculatedPages.push({
              id: currentPageId,
              content: pageData.content,
              chapterTitle: pageData.chapterTitle,
              metadata: pageData.metadata
            })

            currentPageContent = ''
            currentPageId = `page-${Date.now()}-${Math.random()}`
            currentBlockIds = [blockId]

            const blockWidth = measureTextWidth(blockContent)
            if (blockWidth <= actualMaxWidth) {
              currentPageContent = blockContent
            } else {
              let remainingBlockContent = blockContent

              while (remainingBlockContent.length > 0) {
                const fittingText = await findFittingText(remainingBlockContent, actualMaxWidth)

                if (fittingText.length > 0) {
                  const fittingTextLength = fittingText.replace(/　/g, '').length
                  currentBlockProcessedLength += fittingTextLength
                  const pageData = enrichPageWithMetadata(
                    fittingText,
                    currentChapterTitle,
                    currentChapterId,
                    [blockId],
                    false,
                    false,
                    currentBlockProcessedLength
                  )
                  calculatedPages.push({
                    id: currentPageId,
                    content: pageData.content,
                    chapterTitle: pageData.chapterTitle,
                    metadata: pageData.metadata
                  })

                  remainingBlockContent = remainingBlockContent.substring(fittingText.length)
                  currentPageId = `page-${Date.now()}-${Math.random()}`
                } else {
                  break
                }
              }

              if (remainingBlockContent.length > 0) {
                currentPageContent = remainingBlockContent
              }
            }
          }
        } else {
          // ブロック全体がページに収まる場合
          currentPageContent = testContent
          // ブロックの全長を記録
          const originalBlockText = blockTexts.get(blockId) || ''
          lastBlockCharacterOffset = originalBlockText.length
        }
      }

      // 最後のページを保存
      if (currentPageContent) {
        const pageData = enrichPageWithMetadata(
          currentPageContent,
          currentChapterTitle,
          currentChapterId,
          currentBlockIds,
          false,
          false,
          lastBlockCharacterOffset
        )
        calculatedPages.push({
          id: currentPageId,
          content: pageData.content,
          chapterTitle: pageData.chapterTitle,
          metadata: pageData.metadata
        })
      }

      setPages(calculatedPages)
      setProgress({ current: structuredBlocks.length, total: structuredBlocks.length })

      // 位置復元の処理
      if (initialPosition && !hasTriedPositionRestore.current) {
        hasTriedPositionRestore.current = true
        const foundResult = findNearestPageToPosition(calculatedPages, initialPosition)
        if (foundResult) {
          setRestoredPageIndex(foundResult.pageIndex)
          onPositionRestored?.(foundResult.pageIndex)
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ページネーション計算エラー'
      setError(errorMessage)
    } finally {
      setIsCalculating(false)
    }
  }, [bookData, containerHeight, maxWidth, fontSize, lineHeight, getStructuredBlocks, findFittingText, measureTextWidth, measureActualDisplayArea])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (measurementDivRef.current) {
        document.body.removeChild(measurementDivRef.current)
        measurementDivRef.current = null
      }
    }
  }, [])

  // パラメータ変更時に再計算
  useEffect(() => {
    if (bookData && containerHeight && maxWidth && fontSize && lineHeight) {
      const timeoutId = setTimeout(() => {
        calculatePagination()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [bookData, containerHeight, maxWidth, fontSize, lineHeight])

  // 位置復元完了のリセット
  const resetPositionRestore = useCallback(() => {
    hasTriedPositionRestore.current = false
    setRestoredPageIndex(null)
  }, [])

  return {
    pages,
    isCalculating,
    error,
    progress,
    recalculate: calculatePagination,
    restoredPageIndex,
    resetPositionRestore
  }
}