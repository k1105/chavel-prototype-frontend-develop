'use client'

import { forwardRef, useImperativeHandle, useRef, CSSProperties } from 'react'
import { Noto_Serif_JP } from 'next/font/google'

const notoSerifJP = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap'
})

export interface VerticalTextRendererProps {
  text?: string
  height: number  // 縦幅は固定
  width?: number | 'auto'  // 横幅は固定か可変
  fontSize: number
  lineHeight: number
  fontFamily: string
  letterSpacing: string
  className?: string
  alignRight?: boolean  // 章終わりページの右寄せ
}

export interface VerticalTextRendererRef {
  getContentSize: () => { width: number; height: number } | null
  getElement: () => HTMLDivElement | null
}

export const VerticalTextRenderer = forwardRef<VerticalTextRendererRef, VerticalTextRendererProps>(
  ({
    text = '',
    height,
    width = 'auto',
    fontSize,
    lineHeight,
    fontFamily,
    letterSpacing,
    className = '',
    alignRight = false
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      getContentSize: () => {
        if (!containerRef.current) return null
        const rect = containerRef.current.getBoundingClientRect()
        const scrollWidth = containerRef.current.scrollWidth
        const scrollHeight = containerRef.current.scrollHeight

        return {
          width: scrollWidth,
          height: scrollHeight
        }
      },
      getElement: () => containerRef.current
    }))

    const containerStyle: CSSProperties = {
      height: `${height}px`,
      width: width === 'auto' ? 'auto' : `${width}px`,
      fontSize: `${fontSize}px`,
      lineHeight: lineHeight,
      fontFamily: `${notoSerifJP.style.fontFamily}, ${fontFamily}`,
      letterSpacing: letterSpacing,
      writingMode: 'vertical-rl' as any,
      WebkitWritingMode: 'vertical-rl' as any,
      msWritingMode: 'tb-rl' as any,
      textOrientation: 'mixed' as any,
      WebkitTextOrientation: 'mixed' as any,
      direction: 'ltr',
      overflow: 'visible',
      whiteSpace: 'pre-wrap',
      wordBreak: 'normal',
      overflowWrap: 'break-word'
    }

    return (
      <div
        ref={containerRef}
        className={`${notoSerifJP.className} ${className} ${alignRight ? 'ml-auto' : ''}`}
        style={containerStyle}
        data-vertical-text-renderer
      >
        {text}
      </div>
    )
  }
)

VerticalTextRenderer.displayName = 'VerticalTextRenderer'