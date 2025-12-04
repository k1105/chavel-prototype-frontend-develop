import { useState, useCallback, useEffect, useRef } from 'react'
import { useTextAreaMeasurement } from './use-text-area-measurement'
import { RealDOMPaginationCalculator, parseBookContent, Page } from '@/lib/utils/real-dom-pagination-calculator'
import type { BookData } from '@/types/book'

interface UseRealPaginationParams {
  book: BookData | null
  containerWidth: number
  containerHeight: number
  fontSize: number
  lineHeight: number
  fontFamily: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  letterSpacing: string
}

interface UseRealPaginationReturn {
  pages: Page[]
  currentPage: Page | null
  currentPageIndex: number
  isReady: boolean
  isCalculating: boolean
  error: string | null
  totalPages: number
  summary: {
    chapterCount: number
    totalBlocks: number
  }
  initializePagination: () => Promise<void>
  goToPage: (index: number) => void
  nextPage: () => void
  prevPage: () => void
  resetPagination: () => void
}

export function useRealPagination(params: UseRealPaginationParams): UseRealPaginationReturn {
  const [pages, setPages] = useState<Page[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    chapterCount: 0,
    totalBlocks: 0
  })

  const calculatorRef = useRef<RealDOMPaginationCalculator | null>(null)

  const {
    measurements,
    isReady: measurementReady,
    measureTextArea,
    resetMeasurement,
    error: measurementError
  } = useTextAreaMeasurement({
    width: params.containerWidth,
    height: params.containerHeight,
    fontSize: params.fontSize,
    lineHeight: params.lineHeight,
    fontFamily: params.fontFamily,
    writingMode: params.writingMode,
    letterSpacing: params.letterSpacing
  })

  const initializePagination = useCallback(async () => {
    if (!params.book?.content) {
      setError('書籍データがありません')
      return
    }

    setIsCalculating(true)
    setError(null)

    try {
      console.log('実測定ファーストページネーション開始')

      // Step 1: 実測定実行
      console.log('Step 1: 実測定実行中...')
      const realMeasurements = await measureTextArea()
      console.log('実測定完了:', realMeasurements)

      // Step 2: 測定DOM作成
      console.log('Step 2: 測定DOM作成中...')
      if (calculatorRef.current) {
        calculatorRef.current.dispose()
      }
      calculatorRef.current = new RealDOMPaginationCalculator(realMeasurements)

      // Step 3: テキスト解析
      console.log('Step 3: テキスト解析中...')
      // BookDataの構造化されたコンテンツを文字列に変換
      const contentText = params.book.content.chapters
        .map(chapter =>
          chapter.blocks.map(block => block.text).join('\n')
        )
        .join('\n\n')
      const textBlocks = parseBookContent(contentText)
      console.log(`解析完了: ${textBlocks.length}ブロック`)

      const chapterCount = textBlocks.filter(block => block.type === 'chapter').length

      setSummary({
        chapterCount,
        totalBlocks: textBlocks.length
      })

      // Step 4: ページ分割計算
      console.log('Step 4: ページ分割計算中...')
      const calculatedPages = await calculatorRef.current.calculatePages(textBlocks)
      console.log(`ページ分割完了: ${calculatedPages.length}ページ`)

      setPages(calculatedPages)
      setCurrentPageIndex(0)

    } catch (calculateError) {
      console.error('ページネーション計算エラー:', calculateError)
      const errorMessage = calculateError instanceof Error
        ? calculateError.message
        : '計算中にエラーが発生しました'
      setError(errorMessage)
    } finally {
      setIsCalculating(false)
    }
  }, [params.book, measureTextArea])

  const goToPage = useCallback((index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index)
    }
  }, [pages.length])

  const nextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1)
    }
  }, [currentPageIndex, pages.length])

  const prevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1)
    }
  }, [currentPageIndex])

  const resetPagination = useCallback(() => {
    setPages([])
    setCurrentPageIndex(0)
    setIsCalculating(false)
    setError(null)
    setSummary({ chapterCount: 0, totalBlocks: 0 })

    if (calculatorRef.current) {
      calculatorRef.current.dispose()
      calculatorRef.current = null
    }

    resetMeasurement()
  }, [resetMeasurement])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.dispose()
      }
    }
  }, [])

  // エラー統合
  const combinedError = error || measurementError

  const currentPage = pages.length > 0 ? pages[currentPageIndex] : null
  const isReady = measurementReady && !isCalculating && pages.length > 0

  return {
    pages,
    currentPage,
    currentPageIndex,
    isReady,
    isCalculating,
    error: combinedError,
    totalPages: pages.length,
    summary,
    initializePagination,
    goToPage,
    nextPage,
    prevPage,
    resetPagination
  }
}