'use client'

import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react'

export interface TextAreaMeasurements {
  containerSize: { width: number; height: number }
  textAreaSize: { width: number; height: number }
  paddingArea: { width: number; height: number }
  titleSpaceSize: { width: number; height: number }
  effectiveTextArea: { width: number; height: number }
}

interface TextMeasurementAreaProps {
  width: number
  height: number
  fontSize: number
  lineHeight: number
  fontFamily: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  letterSpacing: string
  text?: string
  onSizeChange?: (measurements: TextAreaMeasurements) => void
}

export interface TextMeasurementAreaRef {
  measureSize: () => TextAreaMeasurements | null
  container: HTMLDivElement | null
  textArea: HTMLDivElement | null
  titleSpace: HTMLDivElement | null
}

export const TextMeasurementArea = forwardRef<TextMeasurementAreaRef, TextMeasurementAreaProps>(
  ({
    width,
    height,
    fontSize,
    lineHeight,
    fontFamily,
    writingMode,
    letterSpacing,
    text = '',
    onSizeChange
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const textAreaRef = useRef<HTMLDivElement>(null)
    const titleSpaceRef = useRef<HTMLDivElement>(null)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)

    const measureSize = (): TextAreaMeasurements | null => {
      if (!containerRef.current || !textAreaRef.current || !titleSpaceRef.current) {
        return null
      }

      const containerRect = containerRef.current.getBoundingClientRect()
      const textAreaRect = textAreaRef.current.getBoundingClientRect()
      const titleSpaceRect = titleSpaceRef.current.getBoundingClientRect()

      const containerStyle = window.getComputedStyle(containerRef.current)
      const textAreaStyle = window.getComputedStyle(textAreaRef.current)

      const paddingTop = parseFloat(containerStyle.paddingTop)
      const paddingBottom = parseFloat(containerStyle.paddingBottom)
      const paddingLeft = parseFloat(containerStyle.paddingLeft)
      const paddingRight = parseFloat(containerStyle.paddingRight)

      const measurements: TextAreaMeasurements = {
        containerSize: {
          width: containerRect.width,
          height: containerRect.height
        },
        textAreaSize: {
          width: textAreaRect.width,
          height: textAreaRect.height
        },
        paddingArea: {
          width: paddingLeft + paddingRight,
          height: paddingTop + paddingBottom
        },
        titleSpaceSize: {
          width: titleSpaceRect.width,
          height: titleSpaceRect.height
        },
        effectiveTextArea: {
          width: textAreaRect.width - titleSpaceRect.width,
          height: textAreaRect.height
        }
      }

      return measurements
    }

    useImperativeHandle(ref, () => ({
      measureSize,
      container: containerRef.current,
      textArea: textAreaRef.current,
      titleSpace: titleSpaceRef.current
    }))

    useEffect(() => {
      if (!containerRef.current || !textAreaRef.current || !titleSpaceRef.current) return

      const observer = new ResizeObserver((entries) => {
        const measurements = measureSize()
        if (measurements && onSizeChange) {
          onSizeChange(measurements)
        }
      })

      observer.observe(containerRef.current)
      observer.observe(textAreaRef.current)
      observer.observe(titleSpaceRef.current)
      resizeObserverRef.current = observer

      // Initial measurement
      const initialMeasurements = measureSize()
      if (initialMeasurements && onSizeChange) {
        onSizeChange(initialMeasurements)
      }

      return () => {
        observer.disconnect()
        resizeObserverRef.current = null
      }
    }, [width, height, fontSize, lineHeight, fontFamily, writingMode, letterSpacing, onSizeChange])

    return (
      <div
        ref={containerRef}
        data-measurement-container
        className="overflow-hidden bg-white"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          padding: '24px',
          boxSizing: 'border-box'
        }}
      >
        <div
          ref={textAreaRef}
          data-measurement-text-area
          className="h-full relative"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            fontFamily: fontFamily,
            writingMode: writingMode,
            letterSpacing: letterSpacing,
            overflow: 'hidden'
          }}
        >
          <div
            ref={titleSpaceRef}
            data-measurement-title-space
            className="shrink-0"
            style={{
              width: writingMode === 'vertical-rl' ? `${fontSize * 2}px` : 'auto',
              height: writingMode === 'vertical-rl' ? 'auto' : `${fontSize * lineHeight}px`
            }}
          />

          <div
            data-measurement-text-content
            className="break-all"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontFamily: fontFamily,
              writingMode: writingMode,
              letterSpacing: letterSpacing,
              overflow: 'hidden'
            }}
          >
            {text}
          </div>
        </div>
      </div>
    )
  }
)

TextMeasurementArea.displayName = 'TextMeasurementArea'