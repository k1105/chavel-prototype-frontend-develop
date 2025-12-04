'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react'
import { useVerticalTextPagination } from '@/hooks/use-vertical-text-pagination'
import { VerticalTextRenderer } from './vertical-text-renderer'
import type { ContentPosition } from '@/lib/utils/reading-state'
import type { BookData } from '@/types/book'

export interface PaginatedBookReaderRef {
  goToNextPage: () => void
  goToPreviousPage: () => void
  goToPage: (index: number) => void
  getLoadingState: () => { isCalculating: boolean; progress: { current: number; total: number } }
  getCumulativeCharacterCount: (pageIndex: number) => number
  updateSwipeSettings: (settings: { autoCompleteThreshold: number; slideStartThreshold: number }) => void
  triggerSwipeAnimation: (direction: 'next' | 'prev') => void
}

interface PaginatedBookReaderProps {
  bookData: BookData
  height?: number
  width?: number
  fontSize?: number
  lineHeight?: number
  className?: string
  showControls?: boolean
  onPageChange?: (pageIndex: number, totalPages: number, chapterTitle?: string, pageData?: any) => void
  initialPosition?: ContentPosition
  onPositionRestored?: (pageIndex: number) => void
}

export const PaginatedBookReader = forwardRef<PaginatedBookReaderRef, PaginatedBookReaderProps>(({
  bookData,
  height = 600,
  width = 800,
  fontSize = 16,
  lineHeight = 1.6,
  className = '',
  showControls = true,
  onPageChange,
  initialPosition,
  onPositionRestored
}, ref) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [lastValidPage, setLastValidPage] = useState<any>(null)
  const isNavigatingRef = useRef(false)

  // スワイプ制御用の状態
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)

  // スライドアニメーション用の状態
  const [isSliding, setIsSliding] = useState(false)
  const [slideOffset, setSlideOffset] = useState(0) // スワイプ中のオフセット（px）
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null)
  const [enableTransition, setEnableTransition] = useState(true) // transitionの有効/無効

  // 閾値設定（localStorage対応）
  const DEFAULT_AUTO_COMPLETE_THRESHOLD = 0.5 // 50%まで引っ張れば自動完了
  const DEFAULT_SLIDE_START_THRESHOLD = 20 // 20px以上スワイプで開始

  const [swipeSettings, setSwipeSettings] = useState(() => {
    if (typeof window === 'undefined') return {
      autoCompleteThreshold: DEFAULT_AUTO_COMPLETE_THRESHOLD,
      slideStartThreshold: DEFAULT_SLIDE_START_THRESHOLD
    }

    try {
      const saved = localStorage.getItem('chavel-swipe-settings')
      return saved ? JSON.parse(saved) : {
        autoCompleteThreshold: DEFAULT_AUTO_COMPLETE_THRESHOLD,
        slideStartThreshold: DEFAULT_SLIDE_START_THRESHOLD
      }
    } catch {
      return {
        autoCompleteThreshold: DEFAULT_AUTO_COMPLETE_THRESHOLD,
        slideStartThreshold: DEFAULT_SLIDE_START_THRESHOLD
      }
    }
  })

  const AUTO_COMPLETE_THRESHOLD = swipeSettings.autoCompleteThreshold
  const SLIDE_START_THRESHOLD = swipeSettings.slideStartThreshold
  const MAX_SLIDE_DISTANCE = width // コンテナ幅の100%

  // 設定をlocalStorageに保存
  const updateSwipeSettings = useCallback((newSettings: typeof swipeSettings) => {
    setSwipeSettings(newSettings)
    if (typeof window !== 'undefined') {
      localStorage.setItem('chavel-swipe-settings', JSON.stringify(newSettings))
    }
  }, [])

  // ページネーション処理
  const {
    pages,
    isCalculating,
    error,
    progress,
    restoredPageIndex
  } = useVerticalTextPagination({
    bookData,
    containerHeight: height,
    maxWidth: width,
    fontSize,
    lineHeight,
    initialPosition,
    onPositionRestored
  })

  const currentPage = pages[currentPageIndex]

  // ページが変更された時にlastValidPageを即座に更新
  useEffect(() => {
    if (currentPage) {
      setLastValidPage(currentPage)
    }
  }, [currentPage])

  // ページインデックスが変更されたらスライド状態を完全にリセット
  useEffect(() => {
    setIsSliding(false)
    setSlideOffset(0)
    setSlideDirection(null)
    // 遷移直後はtransitionを無効にして、少し待ってから有効化
    setEnableTransition(false)
    const timer = setTimeout(() => {
      setEnableTransition(true)
    }, 50) // 50ms後にtransitionを有効化

    return () => clearTimeout(timer)
  }, [currentPageIndex])

  // 表示するページを決定（currentPageを優先し、なければlastValidPage）
  const pageToDisplay = currentPage || lastValidPage

  // 位置復元の処理
  useEffect(() => {
    if (restoredPageIndex !== null && restoredPageIndex !== currentPageIndex && !isNavigatingRef.current) {
      setCurrentPageIndex(restoredPageIndex)
    }
  }, [restoredPageIndex, currentPageIndex])

  // ページ変更通知用useEffect（初期化時とナビゲーション時）
  const prevPageIndexRef = useRef(-1) // 初期値を-1にして初回実行を保証
  const prevPagesLengthRef = useRef(0) // ページ数の変更も監視

  useEffect(() => {
    if (pages.length > 0) {
      const currentPage = pages[currentPageIndex]

      // ページが変更されたか、またはページ数が変更された時（初期化含む）
      const hasPageIndexChanged = currentPageIndex !== prevPageIndexRef.current
      const hasPagesChanged = pages.length !== prevPagesLengthRef.current

      if (hasPageIndexChanged || hasPagesChanged) {
        // onPageChangeを呼び出す
        onPageChange?.(currentPageIndex, pages.length, currentPage?.chapterTitle, currentPage)

        // refを更新
        prevPageIndexRef.current = currentPageIndex
        prevPagesLengthRef.current = pages.length

        if (isNavigatingRef.current) {
          setTimeout(() => { isNavigatingRef.current = false }, 0)
        }
      }
    }
  }, [currentPageIndex, pages, onPageChange])


  // ページナビゲーション
  const goToNextPage = useCallback(() => {
    isNavigatingRef.current = true
    setCurrentPageIndex(prevIndex => {
      if (prevIndex < pages.length - 1) {
        return prevIndex + 1
      }
      isNavigatingRef.current = false
      return prevIndex
    })
  }, [pages.length])

  const goToPreviousPage = useCallback(() => {
    isNavigatingRef.current = true
    setCurrentPageIndex(prevIndex => {
      if (prevIndex > 0) {
        return prevIndex - 1
      }
      isNavigatingRef.current = false
      return prevIndex
    })
  }, [pages.length])

  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < pages.length) {
      isNavigatingRef.current = true
      setCurrentPageIndex(pageIndex)
    }
  }, [pages])

  // 指定されたページインデックスまでの累積文字数を計算
  const getCumulativeCharacterCount = useCallback((pageIndex: number) => {
    let cumulativeCount = 0
    for (let i = 0; i <= pageIndex && i < pages.length; i++) {
      const content = pages[i]?.content || ''
      // 各行の先頭の全角スペースと改行のみを除外して文字数をカウント
      const cleanedContent = content
        .split('\n')
        .map(line => line.replace(/^　/, '')) // 各行の先頭の全角スペースのみ削除
        .join('')
      cumulativeCount += cleanedContent.length
    }
    return cumulativeCount
  }, [pages])

  // スワイプハンドラ（スライドアニメーション対応）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setIsSliding(false)
    setSlideOffset(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return

    const touch = e.touches[0]
    const deltaX = touchStart.x - touch.clientX
    const deltaY = touchStart.y - touch.clientY

    // 横スワイプが縦スワイプより大きく、開始閾値を超えた場合のみ処理
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SLIDE_START_THRESHOLD) {
      e.preventDefault() // スクロールを防止

      // スワイプ方向を判定（右から左へスワイプ = prev、左から右へスワイプ = next）
      const direction = deltaX > 0 ? 'prev' : 'next'
      setSlideDirection(direction)

      // ページ境界チェック
      const canSlide = direction === 'next'
        ? currentPageIndex < pages.length - 1
        : currentPageIndex > 0

      if (canSlide) {
        setIsSliding(true)
        // オフセットを設定（負の値 = 左にスライド、正の値 = 右にスライド）
        const offset = Math.max(-MAX_SLIDE_DISTANCE, Math.min(MAX_SLIDE_DISTANCE, -deltaX))
        setSlideOffset(offset)
      }
    }
  }, [touchStart, currentPageIndex, pages.length, MAX_SLIDE_DISTANCE])

  // アニメーション リセット処理
  const resetPageSlide = useCallback(() => {
    setIsSliding(false)
    setSlideOffset(0)
    setSlideDirection(null)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !isSliding || !slideDirection) {
      setTouchStart(null)
      resetPageSlide()
      return
    }

    const progress = Math.abs(slideOffset) / MAX_SLIDE_DISTANCE
    const direction = slideDirection

    // 閾値を超えた場合は自動完了、そうでなければリセット
    if (progress > AUTO_COMPLETE_THRESHOLD) {
      // 完了アニメーション（完全にスライドアウト）
      const targetOffset = direction === 'next' ? width : -width
      setSlideOffset(targetOffset)
      setTimeout(() => {
        // transitionを無効化してからページ遷移
        setEnableTransition(false)

        // 次のフレームでページ遷移（transitionが無効な状態で）
        requestAnimationFrame(() => {
          // 即座に状態をリセット
          setIsSliding(false)
          setSlideOffset(0)
          setSlideDirection(null)

          if (direction === 'next') {
            goToNextPage()
          } else {
            goToPreviousPage()
          }
        })
      }, 200)
    } else {
      // 元の位置に戻るアニメーション
      setSlideOffset(0)
      setTimeout(resetPageSlide, 200)
    }

    setTouchStart(null)
  }, [touchStart, isSliding, slideDirection, slideOffset, MAX_SLIDE_DISTANCE, width, goToNextPage, goToPreviousPage, resetPageSlide])

  // ボタンからスワイプアニメーションをトリガー
  const triggerSwipeAnimation = useCallback((direction: 'next' | 'prev') => {
    // 境界チェック
    const canSlide = direction === 'next'
      ? currentPageIndex < pages.length - 1
      : currentPageIndex > 0

    if (!canSlide) return

    // スワイプ状態を初期化（0から開始）
    setSlideDirection(direction)
    setIsSliding(true)
    setSlideOffset(0) // 開始位置を明確に0に設定
    setEnableTransition(false) // 初期位置設定時はtransitionなし

    // 次のフレームでアニメーション開始
    requestAnimationFrame(() => {
      setEnableTransition(true) // transitionを有効化

      // さらに次のフレームでアニメーション実行
      requestAnimationFrame(() => {
        const targetOffset = direction === 'next' ? width : -width
        setSlideOffset(targetOffset)

        setTimeout(() => {
          // transitionを無効化してからページ遷移
          setEnableTransition(false)

          // 次のフレームでページ遷移
          requestAnimationFrame(() => {
            // 即座に状態をリセット
            setIsSliding(false)
            setSlideOffset(0)
            setSlideDirection(null)

            if (direction === 'next') {
              goToNextPage()
            } else {
              goToPreviousPage()
            }
          })
        }, 200) // スワイプと同じアニメーション時間
      })
    })
  }, [currentPageIndex, pages.length, width, goToNextPage, goToPreviousPage])

  // refで外部からアクセス可能にする
  useImperativeHandle(ref, () => ({
    goToNextPage,
    goToPreviousPage,
    goToPage,
    getLoadingState: () => ({ isCalculating, progress }),
    getCumulativeCharacterCount,
    updateSwipeSettings,
    triggerSwipeAnimation
  }))

  if (isCalculating) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-lg mb-2">ページを計算中...</div>
          {progress.total > 0 && (
            <div className="text-sm text-gray-600">
              {progress.current} / {progress.total} ブロック処理済み
            </div>
          )}
          <div className="w-64 bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%'
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center text-red-600">
          <div className="text-lg mb-2">エラーが発生しました</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center text-gray-500">
          <div className="text-lg">ページがありません</div>
        </div>
      </div>
    )
  }

  // 次のページを取得（アニメーション用）
  const getAdjacentPage = () => {
    if (slideDirection === 'next' && currentPageIndex < pages.length - 1) {
      return pages[currentPageIndex + 1]
    } else if (slideDirection === 'prev' && currentPageIndex > 0) {
      return pages[currentPageIndex - 1]
    }
    return null
  }

  const adjacentPage = getAdjacentPage()

  return (
    <div className={`relative ${className}`}>
      {/* スライドアニメーションコンテナ */}
      <div
        className="pr-5"
        style={{
          height: height,
          maxWidth: width,
          margin: '0 auto',
          overflow: 'hidden',
          position: 'relative'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 次のページ（背後に表示） */}
        {isSliding && adjacentPage && (
          <div
            className="absolute"
            style={{
              top: 0,
              left: slideDirection === 'next' ? -width : width,
              width: '100%',
              height: height,
              zIndex: 1,
              transform: `translateX(${slideOffset}px)`,
              transition: enableTransition && (slideOffset === 0 || Math.abs(slideOffset) === width)
                ? 'transform 0.2s ease-out'
                : 'none'
            }}
          >
            <div className="w-full h-full bg-white" style={{ transform: 'translateX(-35px)' }}>
              <VerticalTextRenderer
                text={adjacentPage.content}
                height={height}
                width="auto"
                fontSize={fontSize}
                lineHeight={lineHeight}
                fontFamily="Noto Sans JP, sans-serif"
                letterSpacing="0.1em"
                className="w-full h-full"
                alignRight={true}
              />
            </div>
          </div>
        )}

        {/* 現在のページ */}
        {pageToDisplay && (
          <div
            className="absolute w-full"
            style={{
              top: 0,
              left: 0,
              height: height,
              zIndex: 2,
              transform: `translateX(${slideOffset}px)`,
              transition: enableTransition && (slideOffset === 0 || Math.abs(slideOffset) === width)
                ? 'transform 0.2s ease-out'
                : 'none'
            }}
          >
            <div className="w-full h-full bg-white" style={{ transform: 'translateX(-35px)' }}>
              <VerticalTextRenderer
                text={pageToDisplay.content}
                height={height}
                width="auto"
                fontSize={fontSize}
                lineHeight={lineHeight}
                fontFamily="Noto Sans JP, sans-serif"
                letterSpacing="0.1em"
                className="w-full h-full"
                alignRight={true}
              />
            </div>
          </div>
        )}
      </div>


      {/* ページコントロール */}
      {showControls && (
        <>
          <div className="flex items-center justify-between px-4">
            <button
              onClick={goToPreviousPage}
              disabled={currentPageIndex === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              前のページ →
            </button>

            <div className="flex items-center space-x-4">
              {/* ページ情報 */}
              <div className="text-center">
                <div className="font-medium">
                  {currentPageIndex + 1} / {pages.length}
                </div>
                {currentPage?.chapterTitle && (
                  <div className="text-sm text-gray-600">
                    {currentPage.chapterTitle}
                  </div>
                )}
              </div>

              {/* ページジャンプ */}
              <select
                value={currentPageIndex}
                onChange={(e) => goToPage(parseInt(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pages.map((page, index) => (
                  <option key={page.id} value={index}>
                    {index + 1}: {page.chapterTitle || '章なし'}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPageIndex >= pages.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              ← 次のページ
            </button>
          </div>

          {/* 統計情報 */}
          <div className="mt-1 text-center text-sm text-gray-500">
            総ページ数: {pages.length} |
            現在の文字数: {currentPage?.content.length || 0}
          </div>
        </>
      )}
    </div>
  )
})

PaginatedBookReader.displayName = 'PaginatedBookReader'

export default PaginatedBookReader