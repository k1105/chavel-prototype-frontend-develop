'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PaginatedBookReader, type PaginatedBookReaderRef } from '@/components/paginated-book-reader'
import DraggableSeekbar from '@/components/draggable-seekbar'
import { mockBooks } from '@/lib/mock-data/books'
import wagahaiData from '@/lib/mock-data/wagahai.json'
import { getContentPositionFromPage } from '@/lib/utils/content-position-finder'
import { ContentPositionCalculator } from '@/lib/utils/content-position-calculator'
import type { BookContent } from '@/types/pagination'

type ChatState = 'collapsed' | 'expanded'

interface BookReaderProps {
  bookId: string
  onBack: () => void
  chatState: ChatState
  onChatStateChange: (state: ChatState) => void
  readingState: ReturnType<typeof import('@/hooks/use-reading-state').useReadingState>
  onPageInfoChange?: (pageInfo: {
    currentPageIndex: number
    totalPages: number
    currentChapterTitle?: string
    currentChapterId?: number
    currentBlockId?: number
    currentCharacterOffset?: number
    currentPosition?: number
  }) => void
  onShowControlsChange?: (showControls: boolean) => void
}

export default function BookReader({
  bookId,
  onBack,
  chatState,
  onChatStateChange,
  readingState,
  onPageInfoChange,
  onShowControlsChange,
}: BookReaderProps) {
  const [showControls, setShowControls] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [fontSize] = useState(24)
  const [lineHeight] = useState(2)
  const [pageInfo, setPageInfo] = useState({
    currentPageIndex: 0,
    totalPages: 0,
    currentChapterTitle: undefined as string | undefined
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [fadeOut, setFadeOut] = useState(false)
  const [showNavigationButtons, setShowNavigationButtons] = useState(true)
  const paginatedBookReaderRef = useRef<PaginatedBookReaderRef>(null)
  const positionCalculatorRef = useRef<ContentPositionCalculator | null>(null)
  const book = mockBooks.find((b) => b.id === bookId)

  // 書籍データを取得
  const bookData = bookId === '1' ? wagahaiData : {
    metadata: {
      id: parseInt(bookId, 10),
      title: book?.title || 'サンプル書籍',
      author: book?.author || 'サンプル著者'
    },
    content: {
      chapters: [{
        id: 1,
        title: '第一章',
        blocks: [{
          id: 1,
          type: 'paragraph',
          text: 'これはサンプルテキストです。'
        }]
      }]
    }
  }


  // 固定サイズに設定（リサイズイベントを削除）
  useEffect(() => {
    const HEADER_HEIGHT = 60
    const VERTICAL_MARGIN = 250 // 上125px + 下125px
    const HORIZONTAL_MARGIN = 80 // 左40px + 右40px

    const calculatedHeight = window.innerHeight - HEADER_HEIGHT - VERTICAL_MARGIN
    const calculatedWidth = window.innerWidth - HORIZONTAL_MARGIN

    setContainerSize({
      width: Math.max(calculatedWidth, 400), // 最小幅確保
      height: Math.max(calculatedHeight, 300) // 最小高さ確保
    })
  }, [])

  // 位置計算器の初期化
  useEffect(() => {
    if (bookData?.content) {
      positionCalculatorRef.current = new ContentPositionCalculator(bookData.content as BookContent)
    }
  }, [bookData])

  // UI設定をlocalStorageから読み込み
  useEffect(() => {
    try {
      const uiSaved = localStorage.getItem('chavel-ui-settings')
      if (uiSaved) {
        const uiSettings = JSON.parse(uiSaved)
        setShowNavigationButtons(uiSettings.showNavigationButtons ?? true)
      }
    } catch (error) {
      console.error('Failed to load UI settings:', error)
    }
  }, [])

  // ローディング状態を監視
  useEffect(() => {
    const checkLoadingState = () => {
      if (paginatedBookReaderRef.current) {
        const loadingState = paginatedBookReaderRef.current.getLoadingState()

        // 読み込み完了時にフェードアウトを開始
        if (isLoading && !loadingState.isCalculating) {
          setFadeOut(true)
          setTimeout(() => {
            setIsLoading(false)
            setFadeOut(false)
            // 読み込み完了時にコントロールを非表示にしてチャットエリアを表示
            setShowControls(false)
            onShowControlsChange?.(false)
          }, 500) // フェードアウトのアニメーション時間
        } else {
          setIsLoading(loadingState.isCalculating)
        }

        setLoadingProgress(loadingState.progress)
      }
    }

    // 初期チェック
    checkLoadingState()

    // 定期的にチェック
    const interval = setInterval(checkLoadingState, 100)

    return () => clearInterval(interval)
  }, [isLoading])

  const handleContentClick = () => {
    const newShowControls = !showControls
    setShowControls(newShowControls)
    onShowControlsChange?.(newShowControls)

    // シークバーUIとチャットエリアを連動させる
    // showControlsがtrueの時はチャットを非表示、falseの時はチャットを表示
    if (newShowControls) {
      // コントロール表示時はチャットを閉じる
      onChatStateChange('collapsed')
    } else {
      // コントロール非表示時はチャットを元に戻す（デフォルトはcollapsed）
      onChatStateChange('collapsed')
    }
  }

  const handlePageChange = useCallback((pageIndex: number, total: number, chapterTitle?: string, pageData?: any) => {

    // 現在のページまでの累積文字数を計算（過去のページを含む）
    let currentPosition = 0
    if (paginatedBookReaderRef.current) {
      currentPosition = paginatedBookReaderRef.current.getCumulativeCharacterCount(pageIndex)
    }

    // 最後のブロックIDとオフセット情報を取得
    const endBlockId = pageData?.metadata?.endBlockId || pageData?.metadata?.blockIds?.[pageData?.metadata?.blockIds?.length - 1] || 1
    const endBlockCharacterOffset = pageData?.metadata?.endBlockCharacterOffset || 99999

    // ページ情報を一括更新
    const newPageInfo = {
      currentPageIndex: pageIndex,
      totalPages: total,
      currentChapterTitle: chapterTitle,
      currentChapterId: pageData?.metadata?.chapterId || 1,
      currentBlockId: endBlockId,
      currentCharacterOffset: endBlockCharacterOffset, // 最後のブロックの終了オフセット
      currentPosition: currentPosition // 現在ページまでの累積文字数
    }
    setPageInfo(newPageInfo)
    onPageInfoChange?.(newPageInfo)


    // 読書位置の保存（デバウンス）
    if (pageData?.metadata && readingState) {
      const position = getContentPositionFromPage(pageData, 0)
      if (position) {
        // 前回の保存位置と異なる場合のみ保存
        const currentPos = readingState.currentPosition
        if (!currentPos ||
            currentPos.chapterId !== position.chapterId ||
            currentPos.blockId !== position.blockId) {
          readingState.updatePosition(position, {
            fontSize,
            lineHeight,
            containerWidth: containerSize.width,
            containerHeight: containerSize.height
          })
        }
      }
    }
  }, [readingState, fontSize, lineHeight, containerSize.width, containerSize.height, onPageInfoChange])

  // シークバーからのページ遷移ハンドラー
  const handlePageSeek = useCallback((pageIndex: number) => {
    if (paginatedBookReaderRef.current) {
      paginatedBookReaderRef.current.goToPage(pageIndex)
    }
  }, [])

  // useCallbackをトップレベルに移動
  const handlePositionRestored = useCallback((pageIndex: number) => {
    // 位置復元時に現在のページインデックスを更新（onPageChangeで詳細情報は更新される）
    setPageInfo(prev => ({ ...prev, currentPageIndex: pageIndex }))
    readingState.markPositionRestored()
  }, [readingState])

  // 縦スクロール防止とバウンス防止
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      // チャット展開時は、チャットエリア内のスクロールのみ許可
      if (chatState === 'expanded') {
        // e.targetがチャットメッセージエリア内かどうかをチェック
        const target = e.target as Element
        const chatArea = target.closest('[data-chat-messages]')
        const characterSelection = target.closest('[data-character-selection]')
        if (chatArea || characterSelection) {
          return // チャットエリア内またはキャラクター選択エリア内のスクロールは許可
        }
      }
      // その他の縦方向のスクロールを防止
      e.preventDefault()
    }

    const preventOverscroll = (e: Event) => {
      e.preventDefault()
    }

    // タッチスクロールイベントを防止
    document.addEventListener('touchmove', preventScroll, { passive: false })
    document.addEventListener('overscroll-behavior-y', preventOverscroll, { passive: false })

    // bodyとhtmlのスクロール動作を制御
    const originalBodyStyle = document.body.style.cssText
    const originalHtmlStyle = document.documentElement.style.cssText

    document.body.style.overscrollBehavior = 'none'
    document.body.style.touchAction = chatState === 'expanded' ? 'none' : 'pan-x'
    document.documentElement.style.overscrollBehavior = 'none'

    return () => {
      document.removeEventListener('touchmove', preventScroll)
      document.removeEventListener('overscroll-behavior-y', preventOverscroll)
      document.body.style.cssText = originalBodyStyle
      document.documentElement.style.cssText = originalHtmlStyle
    }
  }, [chatState])

  return (
    <div className="h-screen flex flex-col bg-white relative" style={{ overscrollBehavior: 'none' }}>
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div
          className={`absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-500 ${
            fadeOut ? 'opacity-0' : 'opacity-100'
          }`}>
          <div className="text-center p-8">
            {/* 書籍カバー画像 */}
            {book?.cover && (
              <div className="mb-8 inline-block mx-auto pr-5 pb-5">
                <img
                  src={book.cover}
                  alt={book.title}
                  className="object-cover relative z-10 block w-[400px] h-[566px]"
                  style={{
                    boxShadow: '20px 20px 0px var(--color-shadow)'
                  }}
                />
              </div>
            )}

            {/* パーセント表示 */}
            {loadingProgress.total > 0 && (
              <div className="text-2xl font-semibold text-gray-800">
                {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%
              </div>
            )}
          </div>
        </div>
      )}
      {/* Header - 固定高さ */}
      <header
        className={`bg-white px-4 py-3 flex items-center justify-between transition-all duration-300 h-[60px] ${
          showControls && chatState === 'collapsed' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
        }`}
      >
        <button
          onClick={() => {
            setShowControls(false)
            onBack()
          }}
          className="text-gray-600 hover:text-gray-900"
        >
          <svg className="w-9 h-[25px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" preserveAspectRatio="none">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </header>

      {/* Page Navigation Buttons */}
      {showNavigationButtons && (
        <>
          {/* Previous Page Button (Right) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              paginatedBookReaderRef.current?.triggerSwipeAnimation('prev')
            }}
            className="absolute top-1/2 right-8 z-30 transition-all duration-200 w-0 h-0"
            style={{
              transform: 'translateY(calc(-50% - 20px))',
              borderTop: '19px solid transparent',
              borderBottom: '19px solid transparent',
              borderLeft: '20px solid var(--primary)',
            }}
          />

          {/* Next Page Button (Left) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              paginatedBookReaderRef.current?.triggerSwipeAnimation('next')
            }}
            className="absolute top-1/2 left-8 z-30 transition-all duration-200 w-0 h-0"
            style={{
              transform: 'translateY(calc(-50% - 20px))',
              borderTop: '19px solid transparent',
              borderBottom: '19px solid transparent',
              borderRight: '20px solid var(--primary)',
            }}
          />
        </>
      )}

      {/* Book Content with clickable area */}
      <div
        className="absolute"
        style={{
          top: '100px', // ヘッダー60px + 上マージン40px
          left: '40px', // 左マージン40px
          right: '40px', // 右マージン40px
          bottom: '150px', // 下マージン150px
          opacity: chatState === 'expanded' ? 0.3 : 1
        }}
        onClick={handleContentClick}
      >
        {(
          <PaginatedBookReader
            ref={paginatedBookReaderRef}
            bookData={bookData}
            height={containerSize.height}
            width={containerSize.width}
            fontSize={fontSize}
            lineHeight={lineHeight}
            showControls={false}
            onPageChange={handlePageChange}
            initialPosition={readingState.hasPositionToRestore && readingState.currentPosition ? readingState.currentPosition : undefined}
            onPositionRestored={handlePositionRestored}
            className={`transition-all duration-300 ${showControls ? 'opacity-100' : 'opacity-100'}`}
          />
        )}
      </div>

      {/* Page Controls - チャットエリアの上に配置 */}
      {(
        <div
          className={`fixed left-0 right-0 bg-transparent px-4 py-3 h-20 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
          } ${
            chatState === 'expanded' ? 'bottom-0 opacity-30' : ''
          }`}
          style={{
            zIndex: chatState === 'expanded' ? 45 : 45,
            bottom: chatState === 'expanded' ? '0px' : '8rem', // ChatPanel height exactly
            pointerEvents: showControls ? 'auto' : 'none'
          }}
        >
          <div className="flex items-center justify-center max-w-4xl mx-auto h-full">
            <div className="text-center">
                <div className="mt-auto mb-4 mx-auto transform translate-y-28" style={{ width: '80vw' }}>
                  <DraggableSeekbar
                    currentPage={pageInfo.currentPageIndex}
                    totalPages={pageInfo.totalPages || 1}
                    onPageChange={handlePageSeek}
                    disabled={pageInfo.totalPages <= 1}
                  />
                  {pageInfo.currentChapterTitle && (
                    <div className="mt-4 text-sm font-medium text-gray-700">
                      {pageInfo.currentChapterTitle}
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
