import { useState, useCallback, useRef } from 'react'
import { TextAreaMeasurements } from '@/components/text-measurement-area'

interface UseTextAreaMeasurementReturn {
  measurements: TextAreaMeasurements | null
  isReady: boolean
  measureTextArea: () => Promise<TextAreaMeasurements>
  resetMeasurement: () => void
  error: string | null
}

interface MeasurementConfig {
  width: number
  height: number
  fontSize: number
  lineHeight: number
  fontFamily: string
  writingMode: 'vertical-rl' | 'horizontal-tb'
  letterSpacing: string
}

export function useTextAreaMeasurement(config: MeasurementConfig): UseTextAreaMeasurementReturn {
  const [measurements, setMeasurements] = useState<TextAreaMeasurements | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const measurementContainerRef = useRef<HTMLDivElement | null>(null)

  const measureTextArea = useCallback(async (): Promise<TextAreaMeasurements> => {
    return new Promise((resolve, reject) => {
      setError(null)
      setIsReady(false)

      try {
        // 実測定用のコンテナを画面に配置
        const container = document.createElement('div')
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: ${config.width}px;
          height: ${config.height}px;
          padding: 24px;
          box-sizing: border-box;
          background: white;
          overflow: hidden;
          z-index: 9999;
          visibility: visible;
        `
        container.setAttribute('data-measurement-container', '')

        // テキストエリア作成
        const textArea = document.createElement('div')
        textArea.style.cssText = `
          height: 100%;
          position: relative;
          font-size: ${config.fontSize}px;
          line-height: ${config.lineHeight};
          font-family: ${config.fontFamily};
          writing-mode: ${config.writingMode};
          letter-spacing: ${config.letterSpacing};
          overflow: hidden;
        `
        textArea.setAttribute('data-measurement-text-area', '')

        // タイトル領域作成
        const titleSpace = document.createElement('div')
        if (config.writingMode === 'vertical-rl') {
          titleSpace.style.cssText = `
            width: ${config.fontSize * 2}px;
            height: auto;
            flex-shrink: 0;
          `
        } else {
          titleSpace.style.cssText = `
            width: auto;
            height: ${config.fontSize * config.lineHeight}px;
            flex-shrink: 0;
          `
        }
        titleSpace.setAttribute('data-measurement-title-space', '')

        textArea.appendChild(titleSpace)
        container.appendChild(textArea)
        document.body.appendChild(container)
        measurementContainerRef.current = container

        // DOM要素が画面に配置されるまで待機
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              const containerRect = container.getBoundingClientRect()
              const textAreaRect = textArea.getBoundingClientRect()
              const titleSpaceRect = titleSpace.getBoundingClientRect()

              const containerStyle = window.getComputedStyle(container)
              const paddingTop = parseFloat(containerStyle.paddingTop)
              const paddingBottom = parseFloat(containerStyle.paddingBottom)
              const paddingLeft = parseFloat(containerStyle.paddingLeft)
              const paddingRight = parseFloat(containerStyle.paddingRight)

              const measurementResult: TextAreaMeasurements = {
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
                  width: config.writingMode === 'vertical-rl'
                    ? textAreaRect.width - titleSpaceRect.width
                    : textAreaRect.width,
                  height: config.writingMode === 'vertical-rl'
                    ? textAreaRect.height
                    : textAreaRect.height - titleSpaceRect.height
                }
              }

              console.log('実測定結果:', measurementResult)

              setMeasurements(measurementResult)
              setIsReady(true)

              // 測定完了後にコンテナを非表示化
              container.style.visibility = 'hidden'
              container.style.left = '-9999px'

              resolve(measurementResult)

            } catch (measureError) {
              const errorMessage = measureError instanceof Error ? measureError.message : '測定エラー'
              console.error('測定中エラー:', measureError)
              setError(errorMessage)
              reject(new Error(errorMessage))
            }
          })
        })

      } catch (setupError) {
        const errorMessage = setupError instanceof Error ? setupError.message : 'セットアップエラー'
        console.error('測定セットアップエラー:', setupError)
        setError(errorMessage)
        reject(new Error(errorMessage))
      }
    })
  }, [config])

  const resetMeasurement = useCallback(() => {
    setMeasurements(null)
    setIsReady(false)
    setError(null)

    // 測定コンテナが残っている場合は削除
    if (measurementContainerRef.current) {
      try {
        document.body.removeChild(measurementContainerRef.current)
      } catch (e) {
        console.warn('測定コンテナ削除時の警告:', e)
      }
      measurementContainerRef.current = null
    }
  }, [])

  return {
    measurements,
    isReady,
    measureTextArea,
    resetMeasurement,
    error
  }
}