/**
 * 読書状態管理のユーティリティ
 * localStorage を活用した読書位置の永続化
 */

export interface ContentPosition {
  chapterId: number
  blockId: number
  characterOffset: number
}

export interface ViewSettings {
  fontSize: number
  lineHeight: number
  containerWidth?: number
  containerHeight?: number
}

export interface ReadingState {
  selectedBookId: string
  currentPosition: ContentPosition
  viewSettings: ViewSettings
  timestamp: number
}

const STORAGE_KEY = 'chavel-reading-state'

/**
 * localStorage から読書状態を取得
 */
export function getReadingState(): ReadingState | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const state = JSON.parse(stored) as ReadingState

    // データの整合性チェック
    if (
      !state.selectedBookId ||
      !state.currentPosition ||
      typeof state.currentPosition.chapterId !== 'number' ||
      typeof state.currentPosition.blockId !== 'number' ||
      typeof state.currentPosition.characterOffset !== 'number'
    ) {
      return null
    }

    return state
  } catch (error) {
    console.warn('Failed to parse reading state from localStorage:', error)
    return null
  }
}

/**
 * localStorage に読書状態を保存
 */
export function saveReadingState(state: ReadingState): void {
  if (typeof window === 'undefined') return

  try {
    state.timestamp = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to save reading state to localStorage:', error)
  }
}

/**
 * 特定の書籍の読書状態を取得
 */
export function getBookReadingState(bookId: string): ReadingState | null {
  const state = getReadingState()
  if (!state || state.selectedBookId !== bookId) {
    return null
  }
  return state
}

/**
 * 読書位置を更新
 */
export function updateReadingPosition(
  bookId: string,
  position: ContentPosition,
  viewSettings?: Partial<ViewSettings>
): void {
  const currentState = getReadingState()

  const newState: ReadingState = {
    selectedBookId: bookId,
    currentPosition: position,
    viewSettings: viewSettings
      ? {
          fontSize: viewSettings.fontSize ?? currentState?.viewSettings?.fontSize ?? 16,
          lineHeight: viewSettings.lineHeight ?? currentState?.viewSettings?.lineHeight ?? 1.6,
          containerWidth: viewSettings.containerWidth ?? currentState?.viewSettings?.containerWidth,
          containerHeight: viewSettings.containerHeight ?? currentState?.viewSettings?.containerHeight,
        }
      : currentState?.viewSettings || { fontSize: 16, lineHeight: 1.6 },
    timestamp: Date.now()
  }

  saveReadingState(newState)
}

/**
 * 読書状態をクリア
 */
export function clearReadingState(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear reading state from localStorage:', error)
  }
}

/**
 * 読書状態が有効かチェック
 * 古すぎる状態（30日以上）は無効とする
 */
export function isValidReadingState(state: ReadingState | null): boolean {
  if (!state) return false

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const isRecent = Date.now() - state.timestamp < thirtyDaysMs

  return isRecent && Boolean(state.selectedBookId && state.currentPosition)
}

/**
 * デフォルトの読書位置を作成
 */
export function createDefaultPosition(): ContentPosition {
  return {
    chapterId: 1,
    blockId: 1,
    characterOffset: 0
  }
}

/**
 * 設定値の比較 - ページネーション再計算が必要かどうかを判定
 */
export function shouldRecalculatePagination(
  previous: ViewSettings,
  current: ViewSettings
): boolean {
  return (
    previous.fontSize !== current.fontSize ||
    previous.lineHeight !== current.lineHeight ||
    previous.containerWidth !== current.containerWidth ||
    previous.containerHeight !== current.containerHeight
  )
}