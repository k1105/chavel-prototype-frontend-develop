/**
 * 読書状態管理フック
 * localStorage と同期してリアルタイムで読書位置を保存・復元
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type ReadingState,
  type ContentPosition,
  type ViewSettings,
  getReadingState,
  saveReadingState,
  updateReadingPosition,
  clearReadingState,
  isValidReadingState,
  createDefaultPosition,
  shouldRecalculatePagination
} from '@/lib/utils/reading-state'

export interface UseReadingStateOptions {
  bookId?: string
  defaultViewSettings?: ViewSettings
  autoSave?: boolean
  onPositionRestored?: (position: ContentPosition) => void
  onViewSettingsChanged?: (settings: ViewSettings) => void
}

export function useReadingState(options: UseReadingStateOptions = {}) {
  const {
    bookId,
    defaultViewSettings = { fontSize: 16, lineHeight: 1.6 },
    autoSave = true,
    onPositionRestored,
    onViewSettingsChanged
  } = options

  const [readingState, setReadingState] = useState<ReadingState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasPositionToRestore, setHasPositionToRestore] = useState(false)

  // 初期化時に localStorage から状態を復元
  useEffect(() => {
    const storedState = getReadingState()

    if (bookId && storedState && storedState.selectedBookId === bookId) {
      if (isValidReadingState(storedState)) {
        setReadingState(storedState)
        setHasPositionToRestore(true)
        onPositionRestored?.(storedState.currentPosition)
      } else {
        // 無効な状態の場合はクリア
        clearReadingState()
      }
    }

    setIsLoaded(true)
  }, [bookId, onPositionRestored])

  // 読書位置を更新（重複更新防止）
  const updatePosition = useCallback((
    position: ContentPosition,
    viewSettings?: Partial<ViewSettings>
  ) => {
    if (!bookId) return

    // 現在の位置と同じ場合は更新しない
    if (readingState?.currentPosition &&
        readingState.currentPosition.chapterId === position.chapterId &&
        readingState.currentPosition.blockId === position.blockId &&
        readingState.currentPosition.characterOffset === position.characterOffset) {
      return
    }

    const newState: ReadingState = {
      selectedBookId: bookId,
      currentPosition: position,
      viewSettings: viewSettings
        ? { ...defaultViewSettings, ...readingState?.viewSettings, ...viewSettings }
        : readingState?.viewSettings || defaultViewSettings,
      timestamp: Date.now()
    }

    setReadingState(newState)

    if (autoSave) {
      // デバウンス処理
      const timeoutId = setTimeout(() => {
        saveReadingState(newState)
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [bookId, defaultViewSettings, readingState?.viewSettings, readingState?.currentPosition, autoSave])

  // 設定値のみを更新
  const updateViewSettings = useCallback((
    newSettings: Partial<ViewSettings>
  ) => {
    if (!bookId || !readingState) return

    const previousSettings = readingState.viewSettings
    const updatedSettings = { ...previousSettings, ...newSettings }
    const needsRecalculation = shouldRecalculatePagination(
      previousSettings,
      updatedSettings
    )

    const newState: ReadingState = {
      ...readingState,
      viewSettings: updatedSettings,
      timestamp: Date.now()
    }

    setReadingState(newState)

    if (autoSave) {
      saveReadingState(newState)
    }

    onViewSettingsChanged?.(updatedSettings)

    return needsRecalculation
  }, [bookId, readingState, autoSave, onViewSettingsChanged])

  // 書籍を変更
  const changeBook = useCallback((
    newBookId: string,
    initialPosition?: ContentPosition
  ) => {
    const newState: ReadingState = {
      selectedBookId: newBookId,
      currentPosition: initialPosition || createDefaultPosition(),
      viewSettings: readingState?.viewSettings || defaultViewSettings,
      timestamp: Date.now()
    }

    setReadingState(newState)

    if (autoSave) {
      saveReadingState(newState)
    }
  }, [readingState?.viewSettings, defaultViewSettings, autoSave])

  // 状態をクリア
  const clearState = useCallback(() => {
    setReadingState(null)
    setHasPositionToRestore(false)
    clearReadingState()
  }, [])

  // 手動保存
  const saveState = useCallback(() => {
    if (readingState) {
      saveReadingState(readingState)
    }
  }, [readingState])

  // 位置復元完了マーク
  const markPositionRestored = useCallback(() => {
    setHasPositionToRestore(false)
  }, [])

  // 現在の位置情報
  const currentPosition = readingState?.currentPosition || null
  const currentViewSettings = readingState?.viewSettings || defaultViewSettings
  const selectedBookId = readingState?.selectedBookId || null

  // デバッグ情報
  const debugInfo = {
    isLoaded,
    hasState: Boolean(readingState),
    hasPositionToRestore,
    bookMatches: selectedBookId === bookId,
    timestamp: readingState?.timestamp,
    positionString: currentPosition
      ? `Ch${currentPosition.chapterId}-Block${currentPosition.blockId}+${currentPosition.characterOffset}`
      : 'None'
  }

  return {
    // 状態
    isLoaded,
    currentPosition,
    currentViewSettings,
    selectedBookId,
    hasPositionToRestore,

    // アクション
    updatePosition,
    updateViewSettings,
    changeBook,
    clearState,
    saveState,
    markPositionRestored,

    // デバッグ
    debugInfo
  }
}