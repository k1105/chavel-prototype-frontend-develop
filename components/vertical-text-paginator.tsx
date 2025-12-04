'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface Page {
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

interface BookData {
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

interface VerticalTextPaginatorProps {
  bookData: BookData
  containerHeight: number
  maxWidth: number
  fontSize: number
  lineHeight: number
  onPaginationComplete?: (pages: Page[]) => void
  onProgress?: (current: number, total: number) => void
}

export function VerticalTextPaginator({
  bookData,
  containerHeight,
  maxWidth,
  fontSize,
  lineHeight,
  onPaginationComplete,
  onProgress
}: VerticalTextPaginatorProps) {
  const [pages, setPages] = useState<Page[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // テキストが収まる量を計算（二分探索）
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

      // 統一された測定関数を使用
      const width = measureTextWidth(fullTestContent)

      if (width <= maxWidth) {
        result = testText
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    return result
  }, [measureTextWidth, maxWidth])

  // ページネーション計算
  const calculatePagination = useCallback(async () => {
    setIsCalculating(true)
    setError(null)

    try {
      const structuredBlocks = getStructuredBlocks()

      if (structuredBlocks.length === 0) {
        throw new Error('書籍データがありません')
      }

      const calculatedPages: Page[] = []
      let currentPageContent = ''
      let currentPageId = `page-${Date.now()}`
      let currentChapterTitle: string | undefined

      for (let i = 0; i < structuredBlocks.length; i++) {
        const block = structuredBlocks[i]

        // 進捗報告
        if (onProgress && i % 10 === 0) {
          onProgress(i, structuredBlocks.length)
        }

        // 章の開始
        if (block.type === 'chapter') {
          // 前のページがある場合は保存
          if (currentPageContent) {
            calculatedPages.push({
              id: currentPageId,
              content: currentPageContent,
              chapterTitle: currentChapterTitle
            })
            currentPageContent = ''
            currentPageId = `page-${Date.now()}-${Math.random()}`
          }
          currentChapterTitle = block.chapterTitle
          continue
        }

        // テキストブロックの処理
        let blockContent = block.type === 'paragraph'
          ? `　${block.content}` // 段落は全角1文字の字下げ
          : block.content // 会話はそのまま

        // ブロック間の区切りを決定
        const separator = currentPageContent ? '\n' : ''

        let testContent = currentPageContent + separator + blockContent

        // 測定
        let width = measureTextWidth(testContent)

        if (width > maxWidth && currentPageContent) {
          // オーバーフロー: 現在のページを保存して、ブロックを分割処理

          // 現在のページに収まる分だけを二分探索で見つける
          const fittingPortion = await findFittingText(
            blockContent,
            maxWidth,
            currentPageContent,
            separator
          )

          if (fittingPortion.length > 0) {
            // 収まる分だけを現在のページに追加して保存
            const pageWithFittingPortion = currentPageContent + separator + fittingPortion
            calculatedPages.push({
              id: currentPageId,
              content: pageWithFittingPortion,
              chapterTitle: currentChapterTitle
            })

            // 残りの部分を新しいページで処理
            let remainingContent = blockContent.substring(fittingPortion.length)
            currentPageContent = ''
            currentPageId = `page-${Date.now()}-${Math.random()}`

            // 残りテキストが新しいページに収まるかチェック
            while (remainingContent.length > 0) {
              const remainingWidth = measureTextWidth(remainingContent)

              if (remainingWidth <= maxWidth) {
                // 残り全部が収まる場合
                currentPageContent = remainingContent
                break
              } else {
                // まだオーバーフローする場合は分割
                const nextFittingPortion = await findFittingText(remainingContent, maxWidth)

                if (nextFittingPortion.length > 0) {
                  calculatedPages.push({
                    id: currentPageId,
                    content: nextFittingPortion,
                    chapterTitle: currentChapterTitle
                  })

                  // さらに残りがあれば継続
                  remainingContent = remainingContent.substring(nextFittingPortion.length)
                  currentPageId = `page-${Date.now()}-${Math.random()}`
                } else {
                  // これ以上分割できない場合
                  break
                }
              }
            }
          } else {
            // 現在のページを保存
            calculatedPages.push({
              id: currentPageId,
              content: currentPageContent,
              chapterTitle: currentChapterTitle
            })

            // ブロック全体を新しいページで処理
            currentPageContent = ''
            currentPageId = `page-${Date.now()}-${Math.random()}`

            // ブロック全体が新しいページに収まるかチェック
            const blockWidth = measureTextWidth(blockContent)
            if (blockWidth <= maxWidth) {
              currentPageContent = blockContent
            } else {
              // ブロック全体もオーバーフローする場合は分割
              let remainingBlockContent = blockContent

              while (remainingBlockContent.length > 0) {
                const fittingText = await findFittingText(remainingBlockContent, maxWidth)

                if (fittingText.length > 0) {
                  calculatedPages.push({
                    id: currentPageId,
                    content: fittingText,
                    chapterTitle: currentChapterTitle
                  })

                  remainingBlockContent = remainingBlockContent.substring(fittingText.length)
                  currentPageId = `page-${Date.now()}-${Math.random()}`
                } else {
                  break
                }
              }

              // 最後の残りがあれば設定
              if (remainingBlockContent.length > 0) {
                currentPageContent = remainingBlockContent
              }
            }
          }
        } else {
          // 収まる場合はそのまま追加
          currentPageContent = testContent
        }
      }

      // 最後のページを保存
      if (currentPageContent) {
        calculatedPages.push({
          id: currentPageId,
          content: currentPageContent,
          chapterTitle: currentChapterTitle
        })
      }

      setPages(calculatedPages)

      // 完了コールバック
      if (onPaginationComplete) {
        onPaginationComplete(calculatedPages)
      }

      // 最終進捗報告
      if (onProgress) {
        onProgress(structuredBlocks.length, structuredBlocks.length)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ページネーション計算エラー'
      setError(errorMessage)
    } finally {
      setIsCalculating(false)
    }
  }, [
    bookData,
    maxWidth,
    getStructuredBlocks,
    findFittingText,
    measureTextWidth,
    onPaginationComplete,
    onProgress
  ])

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
      calculatePagination()
    }
  }, [bookData, containerHeight, maxWidth, fontSize, lineHeight, calculatePagination])

  return {
    pages,
    isCalculating,
    error,
    recalculate: calculatePagination
  }
}

export default VerticalTextPaginator