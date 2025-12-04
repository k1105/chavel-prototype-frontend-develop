'use client'

import type React from 'react'

interface TextHighlightProps {
  text: string
  startOffset?: number
  endOffset?: number
  highlightClassName?: string
  children?: React.ReactNode
}

export default function TextHighlight({
  text,
  startOffset = -1,
  endOffset = -1,
  highlightClassName = 'bg-blue-200',
  children,
}: TextHighlightProps) {
  // 改行をbrタグに変換するヘルパー関数
  const renderTextWithBreaks = (textToRender: string) => {
    return textToRender.split('\n').map((line, index, array) => (
      <span key={index}>
        {line}
        {index < array.length - 1 && <br />}
      </span>
    ))
  }

  if (startOffset < 0 || endOffset < 0 || startOffset >= endOffset || startOffset >= text.length) {
    return <>{renderTextWithBreaks(children?.toString() || text)}</>
  }

  const beforeText = text.substring(0, startOffset)
  const selectedText = text.substring(startOffset, endOffset)
  const afterText = text.substring(endOffset)

  return (
    <>
      {renderTextWithBreaks(beforeText)}
      <span className={`${highlightClassName} rounded px-0.5`}>
        {renderTextWithBreaks(selectedText)}
      </span>
      {renderTextWithBreaks(afterText)}
    </>
  )
}
