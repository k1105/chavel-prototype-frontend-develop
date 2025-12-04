import { useCallback, useEffect, useRef, useState } from 'react'
// import { PaginationCalculator } from '@/lib/utils/pagination-calculator'
// import { SimplePaginationCalculator } from '@/lib/utils/simple-pagination-calculator'
import { DOMPaginationCalculator, type MeasurementContext } from '@/lib/utils/dom-pagination-calculator'
import type { BookContent, Page, PaginationState } from '@/types/pagination'

interface UsePaginationProps {
  bookContent: BookContent
  containerWidth?: number
  containerHeight?: number
  fontSize?: number
  lineHeight?: number
  initialPageIndex?: number
  fontFamily?: string
  writingMode?: 'vertical-rl' | 'horizontal-tb'
  letterSpacing?: string
}

interface UsePaginationReturn {
  paginationState: PaginationState
  currentPage: Page | null
  goToPage: (pageIndex: number) => void
  nextPage: () => void
  previousPage: () => void
  goToChapter: (chapterId: number) => void
  goToPosition: (chapterId: number, blockId: number, characterPosition?: number) => void
  isLoading: boolean
  summary: {
    totalPages: number
    totalCharacters: number
    averageCharactersPerPage: number
    chaptersInfo: Array<{ chapterId: number; title: string; startPage: number; pageCount: number }>
  } | null
}

export function usePagination({
  bookContent,
  containerWidth = 800,
  containerHeight = 600,
  fontSize = 16,
  lineHeight = 1.6,
  initialPageIndex = 0,
  fontFamily = 'Noto Sans JP, sans-serif',
  writingMode = 'vertical-rl',
  letterSpacing = '0.1em',
}: UsePaginationProps): UsePaginationReturn {
  const [paginationState, setPaginationState] = useState<PaginationState>({
    currentPageIndex: 0,
    totalPages: 0,
    pages: [],
    containerWidth: 0,
    containerHeight: 0,
    fontSize: 16,
    lineHeight: 1.6,
    charactersPerLine: 0,
    linesPerPage: 0,
  })

  const [currentPage, setCurrentPage] = useState<Page | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [summary, setSummary] = useState<UsePaginationReturn['summary']>(null)

  const calculatorRef = useRef<DOMPaginationCalculator | null>(null)

  // ページネーション計算を実行
  const calculatePagination = useCallback(async () => {
    // bookContentが空の場合はスキップ
    if (!bookContent || bookContent.chapters.length === 0) {
      console.warn('usePagination.calculatePagination: No book content')
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    // Web Worker で処理したいところだが、DOMアクセスが必要なので小さな遅延を入れてUIをブロックしないようにする
    await new Promise((resolve) => setTimeout(resolve, 10))

    try {
      // 既存の計算機を破棄
      if (calculatorRef.current) {
        calculatorRef.current.dispose()
      }

      // DOM測定用のコンテキストを作成
      const measurementContext: MeasurementContext = {
        width: containerWidth,
        height: containerHeight,
        fontSize: `${fontSize}px`,
        lineHeight,
        fontFamily,
        writingMode,
        letterSpacing,
      }

      // 新しい計算機を作成（DOM測定版）
      calculatorRef.current = new DOMPaginationCalculator(bookContent, measurementContext)

      const newState = calculatorRef.current.getPaginationState(initialPageIndex)
      const newSummary = calculatorRef.current.getSummary()

      setPaginationState(newState)
      setSummary(newSummary)

      // 現在のページ内容を設定
      const page = calculatorRef.current.getPageContent(newState.currentPageIndex)
      setCurrentPage(page)
    } catch (error) {
      console.error('Failed to calculate pagination:', error)
    } finally {
      setIsLoading(false)
    }
  }, [
    bookContent,
    containerWidth,
    containerHeight,
    fontSize,
    lineHeight,
    fontFamily,
    writingMode,
    letterSpacing,
    initialPageIndex,
  ]) // DOM測定版は全パラメータを監視

  // bookContentが変わったときのみ再計算
  useEffect(() => {
    calculatePagination()
  }, [calculatePagination])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.dispose()
      }
    }
  }, [])

  // ページ移動
  const goToPage = useCallback(
    (pageIndex: number) => {
      if (!calculatorRef.current || isLoading) return

      const newState = calculatorRef.current.getPaginationState(pageIndex)
      const page = calculatorRef.current.getPageContent(newState.currentPageIndex)

      setPaginationState(newState)
      setCurrentPage(page)
    },
    [isLoading],
  )

  // 次のページへ
  const nextPage = useCallback(() => {
    if (
      !calculatorRef.current ||
      !calculatorRef.current.hasNextPage(paginationState.currentPageIndex)
    ) {
      return
    }
    goToPage(paginationState.currentPageIndex + 1)
  }, [paginationState.currentPageIndex, goToPage])

  // 前のページへ
  const previousPage = useCallback(() => {
    if (
      !calculatorRef.current ||
      !calculatorRef.current.hasPreviousPage(paginationState.currentPageIndex)
    ) {
      return
    }
    goToPage(paginationState.currentPageIndex - 1)
  }, [paginationState.currentPageIndex, goToPage])

  // 章の開始ページへ移動
  const goToChapter = useCallback(
    (chapterId: number) => {
      if (!calculatorRef.current) return

      const chapterStartPage = calculatorRef.current.getChapterStartPage(chapterId)
      goToPage(chapterStartPage)
    },
    [goToPage],
  )

  // 特定の位置へ移動
  const goToPosition = useCallback(
    (chapterId: number, blockId: number, characterPosition = 0) => {
      if (!calculatorRef.current) return

      const pageIndex = calculatorRef.current.findPageByPosition(
        chapterId,
        blockId,
        characterPosition,
      )
      goToPage(pageIndex)
    },
    [goToPage],
  )

  return {
    paginationState,
    currentPage,
    goToPage,
    nextPage,
    previousPage,
    goToChapter,
    goToPosition,
    isLoading,
    summary,
  }
}
