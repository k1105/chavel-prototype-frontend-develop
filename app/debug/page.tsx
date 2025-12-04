'use client'

import { useState } from 'react'
import { useVerticalTextPagination } from '@/hooks/use-vertical-text-pagination'
import { VerticalTextRenderer } from '@/components/vertical-text-renderer'
import wagahaiData from '@/lib/mock-data/wagahai.json'

export default function DebugPage() {
  // 設定パラメータ
  const [containerHeight, setContainerHeight] = useState(600)
  const [maxWidth, setMaxWidth] = useState(800)
  const [fontSize, setFontSize] = useState(16)
  const [lineHeight, setLineHeight] = useState(1.6)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  // ページネーション処理
  const {
    pages,
    isCalculating,
    error,
    progress,
    recalculate
  } = useVerticalTextPagination({
    bookData: wagahaiData,
    containerHeight,
    maxWidth,
    fontSize,
    lineHeight
  })

  const currentPage = pages[currentPageIndex]

  const handleReset = () => {
    setCurrentPageIndex(0)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white p-6 rounded-lg shadow mb-4">
          <h1 className="text-2xl font-bold mb-4">📖 縦書きページネーション デバッグ画面</h1>

          {/* 設定パラメータ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">縦幅（固定）</label>
              <input
                type="range"
                min="400"
                max="800"
                step="50"
                value={containerHeight}
                onChange={(e) => setContainerHeight(parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{containerHeight}px</span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">最大横幅</label>
              <input
                type="range"
                min="400"
                max="1200"
                step="50"
                value={maxWidth}
                onChange={(e) => setMaxWidth(parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{maxWidth}px</span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">フォントサイズ</label>
              <input
                type="range"
                min="12"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{fontSize}px</span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">行の高さ</label>
              <input
                type="range"
                min="1.2"
                max="2.0"
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{lineHeight}</span>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-2">
            <button
              onClick={recalculate}
              disabled={isCalculating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isCalculating ? '計算中...' : '📊 ページネーション計算実行'}
            </button>

            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              🔄 リセット
            </button>
          </div>

          {/* 進捗表示 */}
          {isCalculating && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">
                進捗: {progress.current} / {progress.total} ブロック処理済み
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%'
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 統計パネル */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">📊 ページネーション統計</h2>

            {pages.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded">
                  <div className="text-sm font-medium text-blue-900">総ページ数</div>
                  <div className="text-2xl font-bold text-blue-600">{pages.length}</div>
                </div>

                <div className="p-3 bg-green-50 rounded">
                  <div className="text-sm font-medium text-green-900">総文字数</div>
                  <div className="text-xl font-bold text-green-600">
                    {pages.reduce((sum, page) => sum + page.content.length, 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded">
                  <div className="text-sm font-medium text-purple-900">平均文字数/ページ</div>
                  <div className="text-xl font-bold text-purple-600">
                    {Math.round(pages.reduce((sum, page) => sum + page.content.length, 0) / pages.length)}
                  </div>
                </div>

                <div className="p-3 bg-orange-50 rounded">
                  <div className="text-sm font-medium text-orange-900">章数</div>
                  <div className="text-xl font-bold text-orange-600">
                    {wagahaiData.content.chapters.length}
                  </div>
                </div>

                {/* ページ分布 */}
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">ページ文字数分布</h3>
                  <div className="space-y-1">
                    {pages.slice(0, 5).map((page, index) => (
                      <div key={page.id} className="flex justify-between text-xs">
                        <span>ページ{index + 1}</span>
                        <span>{page.content.length}文字</span>
                      </div>
                    ))}
                    {pages.length > 5 && (
                      <div className="text-xs text-gray-500">...他{pages.length - 5}ページ</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                <div className="text-lg mb-2">📊</div>
                <div>ページネーション計算を実行してください</div>
              </div>
            )}
          </div>

          {/* ページ表示エリア */}
          <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">📚 書籍表示</h2>

            {/* ページコントロール - フルワイド */}
            {pages.length > 0 && (
              <div className="mb-4 -mx-4">
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <button
                    onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                    disabled={currentPageIndex >= pages.length - 1}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors"
                  >
                    ← 次のページ
                  </button>

                  <div className="text-center">
                    <div className="font-medium">
                      {currentPageIndex + 1} / {pages.length}
                    </div>
                    {currentPage?.chapterTitle && (
                      <div className="text-sm text-gray-600">
                        {currentPage.chapterTitle}
                      </div>
                    )}

                    {/* ページジャンプ */}
                    <select
                      value={currentPageIndex}
                      onChange={(e) => setCurrentPageIndex(parseInt(e.target.value))}
                      className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {pages.map((page, index) => (
                        <option key={page.id} value={index}>
                          {index + 1}: {page.chapterTitle || '章なし'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                    disabled={currentPageIndex === 0}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors"
                  >
                    前のページ →
                  </button>
                </div>
              </div>
            )}

            {/* 表示エリア */}
            <div
              className="border-2 border-gray-300 rounded p-4 overflow-hidden"
              style={{
                maxWidth: `${maxWidth}px`,
                margin: '0 auto'
              }}
            >
              {isCalculating ? (
                <div
                  className="flex items-center justify-center text-gray-400"
                  style={{ height: `${containerHeight}px` }}
                >
                  <div className="text-center">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-lg mb-2">ページネーション計算中...</p>
                    <p className="text-sm">
                      {progress.current} / {progress.total} ブロック処理済み
                    </p>
                  </div>
                </div>
              ) : currentPage ? (
                <VerticalTextRenderer
                  text={currentPage.content}
                  height={containerHeight}
                  width="auto"
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  fontFamily="Noto Sans JP, sans-serif"
                  letterSpacing="0.1em"
                  className="mx-auto"
                  alignRight={currentPage.isChapterEnd}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-gray-400"
                  style={{ height: `${containerHeight}px` }}
                >
                  <div className="text-center">
                    <p className="text-lg mb-2">表示するページがありません</p>
                    <p className="text-sm">設定を調整して計算を実行してください</p>
                  </div>
                </div>
              )}
            </div>

            {/* ページ情報 */}
            {currentPage && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
                <div><strong>ページID:</strong> {currentPage.id}</div>
                <div><strong>文字数:</strong> {currentPage.content.length}</div>
                <div><strong>章タイトル:</strong> {currentPage.chapterTitle || 'なし'}</div>
                <div><strong>設定:</strong> {containerHeight}×{maxWidth}px, {fontSize}px, 行間{lineHeight}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}