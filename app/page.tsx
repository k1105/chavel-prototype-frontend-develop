'use client'

import { useState, useEffect } from 'react'
import BookList from './_components/book-list'
import BookReader from './_components/book-reader'
import ChatPanel from './_components/chat-panel'
import SplashScreen from './_components/splash-screen'
import { useReadingState } from '@/hooks/use-reading-state'
import { getReadingState, isValidReadingState } from '@/lib/utils/reading-state'

type ViewType = 'library' | 'reader'
type ChatState = 'collapsed' | 'expanded'

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>('library')
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [chatState, setChatState] = useState<ChatState>('collapsed')
  const [isInitialized, setIsInitialized] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [showReaderControls, setShowReaderControls] = useState(false)
  const [currentPageInfo, setCurrentPageInfo] = useState<{
    currentPageIndex: number
    totalPages: number
    currentChapterTitle?: string
    currentChapterId?: number
    currentBlockId?: number
    currentCharacterOffset?: number
  } | null>(null)

  // 読書状態の管理
  const readingState = useReadingState({
    bookId: selectedBookId || undefined,
    autoSave: true
  })

  // 初期化時にlocalStorageから状態を復元
  useEffect(() => {
    const storedState = getReadingState()

    if (storedState && isValidReadingState(storedState)) {
      setSelectedBookId(storedState.selectedBookId)
      setCurrentView('reader')
      console.log('Reading state restored:', {
        bookId: storedState.selectedBookId,
        position: `Ch${storedState.currentPosition.chapterId}-Block${storedState.currentPosition.blockId}+${storedState.currentPosition.characterOffset}`
      })
    }

    setIsInitialized(true)
  }, [])

  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId)
    setCurrentView('reader')
    // 新しい書籍を選択時は読書状態をリセット
    readingState.changeBook(bookId)
  }

  const handleBackToLibrary = () => {
    setCurrentView('library')
    setSelectedBookId(null)
    setChatState('collapsed')
    // ライブラリに戻る時は状態をクリア
    readingState.clearState()
  }

  // スプラッシュスクリーン表示中も背景で初期化を継続
  // 初期化完了前かつスプラッシュ非表示の場合のみローディング表示
  if (!isInitialized && !showSplash) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">読み込み中...</div>
          <div className="text-sm text-gray-600">読書状態を復元しています</div>
        </div>
      </div>
    )
  }

  const mainContent = currentView === 'library' ? (
    <div className="min-h-screen bg-gray-50">
      <BookList onBookSelect={handleBookSelect} />
    </div>
  ) : (
    <div className="min-h-screen bg-gray-50 relative">
      {/* BookReader - 常に全画面表示 */}
      <div className="h-screen">
        <BookReader
          bookId={selectedBookId || ''}
          onBack={handleBackToLibrary}
          chatState={chatState}
          onChatStateChange={setChatState}
          readingState={readingState}
          onPageInfoChange={setCurrentPageInfo}
          onShowControlsChange={setShowReaderControls}
        />
      </div>

      {/* ChatPanel - オーバーレイ表示 */}
      <div
        className={`fixed bottom-0 left-0 right-0 shadow-lg transition-all duration-200 ease-out ${
          chatState === 'expanded' ? 'h-full z-50' : 'h-32 z-40'
        }`}
      >
        <ChatPanel
          bookId={selectedBookId || ''}
          isExpanded={chatState === 'expanded'}
          onToggleExpand={() => setChatState(chatState === 'expanded' ? 'collapsed' : 'expanded')}
          showReaderControls={showReaderControls}
          currentPageInfo={currentPageInfo || undefined}
        />
      </div>
    </div>
  )

  return (
    <>
      {mainContent}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </>
  )
}
