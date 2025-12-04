'use client'

import { useEffect, useRef, useState } from 'react'
import { usePagination } from '@/hooks/use-pagination'
import type { BookContent } from '@/types/pagination'

interface PaginationDemoProps {
  bookContent: BookContent
  className?: string
}

export function PaginationDemo({ bookContent, className = '' }: PaginationDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [fontSize, setFontSize] = useState(16)
  const [lineHeight, setLineHeight] = useState(1.6)

  // コンテナサイズの測定
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({
          width: rect.width || 800,
          height: rect.height || 600,
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const {
    paginationState,
    currentPage,
    goToPage,
    nextPage,
    previousPage,
    goToChapter,
    isLoading,
    summary,
  } = usePagination({
    bookContent,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height - 100, // ナビゲーション分を除く
    fontSize,
    lineHeight,
  })

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-lg">ページを計算中...</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-screen max-h-screen ${className}`}>
      {/* 設定パネル */}
      <div className="bg-gray-100 p-4 border-b">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label htmlFor="fontSize">文字サイズ:</label>
            <input
              id="fontSize"
              type="range"
              min="12"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20"
            />
            <span>{fontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="lineHeight">行間:</label>
            <input
              id="lineHeight"
              type="range"
              min="1.2"
              max="2.0"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-20"
            />
            <span>{lineHeight}</span>
          </div>
          {summary && (
            <div className="text-gray-600">
              総ページ数: {summary.totalPages} | 文字数: {summary.totalCharacters.toLocaleString()}{' '}
              | 1ページ平均: {Math.round(summary.averageCharactersPerPage)}文字
            </div>
          )}
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex">
        {/* 本文表示エリア */}
        <div
          ref={containerRef}
          className="flex-1 p-8 overflow-hidden"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
          }}
        >
          {currentPage && (
            <div className="h-full">
              <div className="mb-4 text-sm text-gray-500">
                第{currentPage.position.chapterId}章 - ブロック{currentPage.position.blockId}(
                {currentPage.position.characterStart + 1}-{currentPage.position.characterEnd}文字目)
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {currentPage.content.join('')}
              </div>
            </div>
          )}
        </div>

        {/* サイドバー - 章一覧 */}
        <div className="w-64 bg-gray-50 border-l p-4 overflow-y-auto">
          <h3 className="font-bold mb-4">目次</h3>
          {summary?.chaptersInfo.map((chapter) => (
            <button
              key={chapter.chapterId}
              onClick={() => goToChapter(chapter.chapterId)}
              className={`block w-full text-left p-2 rounded text-sm hover:bg-gray-200 ${
                currentPage?.position.chapterId === chapter.chapterId
                  ? 'bg-blue-100 border-l-4 border-blue-500'
                  : ''
              }`}
            >
              <div className="font-medium">{chapter.title}</div>
              <div className="text-xs text-gray-500">
                {chapter.pageCount}ページ (p.{chapter.startPage + 1}-)
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ナビゲーションバー */}
      <div className="bg-gray-100 p-4 border-t flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={previousPage}
            disabled={!paginationState || paginationState.currentPageIndex === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            ← 前のページ
          </button>
          <button
            onClick={nextPage}
            disabled={
              !paginationState || paginationState.currentPageIndex >= paginationState.totalPages - 1
            }
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            次のページ →
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>ページ:</span>
            <input
              type="number"
              min="1"
              max={paginationState.totalPages}
              value={(paginationState.currentPageIndex + 1).toString()}
              onChange={(e) => {
                const pageNum = Number(e.target.value)
                if (pageNum >= 1 && pageNum <= paginationState.totalPages) {
                  goToPage(pageNum - 1)
                }
              }}
              className="w-20 px-2 py-1 border rounded text-center"
            />
            <span>/ {paginationState.totalPages}</span>
          </div>

          <div className="text-sm text-gray-600">
            {paginationState.charactersPerLine}文字/行 × {paginationState.linesPerPage}行
          </div>
        </div>
      </div>
    </div>
  )
}
