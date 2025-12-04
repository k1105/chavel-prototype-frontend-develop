'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface DraggableSeekbarProps {
  currentPage: number
  totalPages: number
  onPageChange: (pageIndex: number) => void
  disabled?: boolean
  className?: string
}

export default function DraggableSeekbar({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className = ''
}: DraggableSeekbarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState(0)
  const [tooltipPage, setTooltipPage] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  // 現在のページから位置を計算（逆向きに修正）
  const currentPosition = totalPages > 0 ? ((totalPages - 1 - currentPage) / (totalPages - 1)) * 100 : 0

  // ドラッグ位置からページ番号を計算（逆向きに修正）
  const calculatePageFromPosition = useCallback((position: number): number => {
    const clampedPosition = Math.max(0, Math.min(100, position))
    const pageFloat = ((100 - clampedPosition) / 100) * (totalPages - 1)
    return Math.round(pageFloat)
  }, [totalPages])

  // マウス/タッチ位置から相対位置を計算
  const getRelativePosition = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const position = ((clientX - rect.left) / rect.width) * 100
    return Math.max(0, Math.min(100, position))
  }, [])

  // ドラッグ開始
  const handleStart = useCallback((clientX: number) => {
    if (disabled) return
    setIsDragging(true)
    const position = getRelativePosition(clientX)
    setDragPosition(position)
    setTooltipPage(calculatePageFromPosition(position))
  }, [disabled, getRelativePosition, calculatePageFromPosition])

  // ドラッグ中
  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return
    const position = getRelativePosition(clientX)
    setDragPosition(position)
    setTooltipPage(calculatePageFromPosition(position))
  }, [isDragging, getRelativePosition, calculatePageFromPosition])

  // ドラッグ終了
  const handleEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    const targetPage = calculatePageFromPosition(dragPosition)
    if (targetPage !== currentPage) {
      onPageChange(targetPage)
    }
  }, [isDragging, dragPosition, calculatePageFromPosition, currentPage, onPageChange])

  // マウスイベント
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX)
  }, [handleMove])

  const handleMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // タッチイベント
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleStart(touch.clientX)
  }

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMove(touch.clientX)
  }, [handleMove])

  const handleTouchEnd = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // グローバルイベントリスナー
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  const displayPosition = isDragging ? dragPosition : currentPosition

  return (
    <div className={`relative ${className}`}>
      {/* ページバルーン（常時表示） */}
      <div
        className="absolute -top-[75px] pointer-events-none transform -translate-x-full"
        style={{ left: `calc(${displayPosition}% + 3px)` }}
      >
        <div className="relative">
          <svg
            width="80"
            height="60"
            viewBox="0 0 82 68"
            className="w-20 h-15"
          >
            <g>
              <path
                className="fill-primary stroke-black stroke-4"
                // strokeLinejoin='bevel'
                d="M67.014,51.997l-2.394.892c-3.358,1.251-6.878,1.885-10.461,1.885h-24.773c-13.998,0-25.387-11.389-25.387-25.387S15.388,4,29.386,4h25.521c13.998,0,25.387,11.389,25.387,25.387l-.258,31.327-13.021-8.717Z"
              />
            </g>
            {/* テキスト */}
            <text
              x="41"
              y="30"
              textAnchor="middle"
              dominantBaseline="central"
              fill="black"
              fontSize="22"
              fontFamily="system-ui, sans-serif"
              fontWeight="bold"
            >
              p.{(isDragging ? tooltipPage : currentPage) + 1}
            </text>
          </svg>
        </div>
      </div>

      {/* シークバートラック */}
      <div
        ref={trackRef}
        className="relative w-full h-[10px] bg-white rounded-full cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* 未読部分のボーダー（左側のみ） */}
        <div
          className="absolute top-0 left-0 h-full rounded-l-full"
          style={{
            width: `${displayPosition}%`,
            border: '1px solid #898989',
            borderRight: 'none'
          }}
        />
        {/* 読了部分のプログレスバー */}
        <div
          className="absolute top-0 right-0 h-full rounded-r-full"
          style={{
            width: `${100 - displayPosition}%`,
            backgroundColor: '#f7d471'
          }}
        />

        {/* ドラッグハンドル */}
        <div
          className={`absolute top-1/2 w-8 h-8 bg-primary rounded-full border-4 border-black shadow-md transform -translate-y-1/2 -translate-x-1/2 cursor-grab ${
            isDragging ? 'cursor-grabbing scale-110' : 'hover:scale-105'
          } transition-transform duration-150 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ left: `${displayPosition}%` }}
        />
      </div>
    </div>
  )
}