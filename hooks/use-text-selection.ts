'use client'

import { type MouseEvent, type TouchEvent, useCallback, useRef, useState } from 'react'

interface TextSelectionRange {
  startOffset: number
  endOffset: number
  selectedText: string
}

interface UseTextSelectionReturn {
  selection: TextSelectionRange | null
  isSelecting: boolean
  handleMouseDown: (e: MouseEvent) => void
  handleMouseMove: (e: MouseEvent) => void
  handleMouseUp: (e: MouseEvent) => void
  handleTouchStart: (e: TouchEvent) => void
  handleTouchMove: (e: TouchEvent) => void
  handleTouchEnd: (e: TouchEvent) => void
  clearSelection: () => void
  getSelectionProps: () => object
}

export function useTextSelection(
  textContent: string,
  containerRef: React.RefObject<HTMLElement | null>,
): UseTextSelectionReturn {
  const [selection, setSelection] = useState<TextSelectionRange | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const currentPosRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)

  const getTextOffsetFromPoint = useCallback(
    (x: number, y: number): number => {
      const container = containerRef.current
      if (!container) return -1

      try {
        // First, try using browser APIs if available
        if (typeof document !== 'undefined') {
          // Try caretRangeFromPoint (WebKit)
          if ('caretRangeFromPoint' in document) {
            try {
              const range = (document as any).caretRangeFromPoint(x, y)
              if (range?.startContainer) {
                return getOffsetFromRange(container, range.startContainer, range.startOffset)
              }
            } catch (_e) {
              // Fallback to manual calculation
            }
          }

          // Try caretPositionFromPoint (Firefox)
          if ('caretPositionFromPoint' in document) {
            try {
              const caretPos = (document as any).caretPositionFromPoint(x, y)
              if (caretPos?.offsetNode) {
                return getOffsetFromRange(container, caretPos.offsetNode, caretPos.offset)
              }
            } catch (_e) {
              // Fallback to manual calculation
            }
          }
        }

        // Fallback: improved manual calculation
        const rect = container.getBoundingClientRect()
        const relativeX = x - rect.left
        const relativeY = y - rect.top

        // Ensure coordinates are within bounds
        if (relativeX < 0 || relativeY < 0 || relativeX > rect.width || relativeY > rect.height) {
          // Clamp to container bounds
          const clampedX = Math.max(0, Math.min(rect.width, relativeX))
          const clampedY = Math.max(0, Math.min(rect.height, relativeY))
          const _xPercent = clampedX / rect.width
          const yPercent = clampedY / rect.height
          return Math.floor(yPercent * textContent.length)
        }

        // Better approximation using line height and character metrics
        const styles = window.getComputedStyle(container)
        const lineHeight = parseFloat(styles.lineHeight) || 24
        const _fontSize = parseFloat(styles.fontSize) || 16

        // For Japanese vertical text, calculate based on Y position primarily
        const lineIndex = Math.floor(relativeY / lineHeight)
        const totalLines = Math.ceil(rect.height / lineHeight)
        const charsPerLine = Math.ceil(textContent.length / totalLines)

        // More accurate character position within line
        const charInLine = Math.floor((relativeX / rect.width) * charsPerLine)
        const approximateOffset = lineIndex * charsPerLine + charInLine

        // Debug logging (remove in production)
        if (process.env.NODE_ENV === 'development') {
          console.log('Position calc:', {
            relativeX,
            relativeY,
            lineHeight,
            lineIndex,
            totalLines,
            charsPerLine,
            charInLine,
            approximateOffset,
            textLength: textContent.length,
          })
        }

        return Math.min(Math.max(0, approximateOffset), textContent.length)
      } catch (error) {
        console.warn('Error getting text offset:', error)
        return -1
      }
    },
    [textContent, containerRef],
  )

  const getOffsetFromRange = useCallback(
    (container: HTMLElement, node: Node, offset: number): number => {
      let totalOffset = 0
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)

      let currentNode = walker.nextNode()
      while (currentNode) {
        if (currentNode === node) {
          return totalOffset + offset
        }
        if (currentNode.textContent) {
          totalOffset += currentNode.textContent.length
        }
        currentNode = walker.nextNode()
      }

      return totalOffset
    },
    [],
  )

  const handleSelectionStart = useCallback(
    (clientX: number, clientY: number) => {
      startPosRef.current = { x: clientX, y: clientY }
      const offset = getTextOffsetFromPoint(clientX, clientY)
      if (offset >= 0) {
        isDraggingRef.current = true
        setIsSelecting(true)
        setSelection(null)
      }
    },
    [getTextOffsetFromPoint],
  )

  const handleSelectionMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDraggingRef.current || !startPosRef.current) return

      currentPosRef.current = { x: clientX, y: clientY }
      const startOffset = getTextOffsetFromPoint(startPosRef.current.x, startPosRef.current.y)
      const endOffset = getTextOffsetFromPoint(clientX, clientY)

      if (startOffset >= 0 && endOffset >= 0) {
        const start = Math.min(startOffset, endOffset)
        const end = Math.max(startOffset, endOffset)

        // Minimum selection threshold to avoid accidental single character selections
        if (end - start >= 1 && end <= textContent.length) {
          const selectedText = textContent.substring(start, end)

          // Allow selections that contain meaningful content (including whitespace)
          if (selectedText.length > 0) {
            setSelection({
              startOffset: start,
              endOffset: end,
              selectedText: selectedText,
            })
          }
        }
      }
    },
    [getTextOffsetFromPoint, textContent],
  )

  const handleSelectionEnd = useCallback(() => {
    setIsSelecting(false)
    isDraggingRef.current = false
    startPosRef.current = null
    currentPosRef.current = null
  }, [])

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      handleSelectionStart(e.clientX, e.clientY)
    },
    [handleSelectionStart],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault()
        handleSelectionMove(e.clientX, e.clientY)
      }
    },
    [handleSelectionMove],
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      handleSelectionEnd()
    },
    [handleSelectionEnd],
  )

  // Touch event handlers
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) {
        handleSelectionStart(touch.clientX, touch.clientY)
      }
    },
    [handleSelectionStart],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault()
        const touch = e.touches[0]
        if (touch) {
          handleSelectionMove(touch.clientX, touch.clientY)
        }
      }
    },
    [handleSelectionMove],
  )

  const handleTouchEnd = useCallback(
    (_e: TouchEvent) => {
      handleSelectionEnd()
    },
    [handleSelectionEnd],
  )

  const clearSelection = useCallback(() => {
    setSelection(null)
    setIsSelecting(false)
    isDraggingRef.current = false
    startPosRef.current = null
    currentPosRef.current = null
  }, [])

  const getSelectionProps = useCallback(
    () => ({
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      style: {
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        MozUserSelect: 'none' as const,
        msUserSelect: 'none' as const,
        WebkitTouchCallout: 'none' as const,
        WebkitTapHighlightColor: 'transparent',
      },
    }),
    [
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
    ],
  )

  return {
    selection,
    isSelecting,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearSelection,
    getSelectionProps,
  }
}
