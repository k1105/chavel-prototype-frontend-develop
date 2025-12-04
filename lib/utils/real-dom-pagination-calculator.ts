import { TextAreaMeasurements } from '@/components/text-measurement-area'

interface MeasurementDOM {
  container: HTMLDivElement
  textArea: HTMLDivElement
  isReady: boolean
  measure: (text: string) => Promise<MeasurementResult>
  dispose: () => void
}

interface MeasurementResult {
  overflow: boolean
  characterCount: number
  textWidth: number
  textHeight: number
  actualText: string
}

export interface Page {
  id: string
  content: string
  chapterTitle?: string
}

interface TextBlock {
  id: string
  type: 'paragraph' | 'conversation' | 'chapter'
  content: string
  chapterTitle?: string
}

export class RealDOMPaginationCalculator {
  private measurementDOM: MeasurementDOM | null = null
  private measurements: TextAreaMeasurements | null = null

  constructor(measurements: TextAreaMeasurements) {
    this.measurements = measurements
    this.measurementDOM = this.createMeasurementDOM(measurements)
  }

  private createMeasurementDOM(measurements: TextAreaMeasurements): MeasurementDOM {
    console.log('測定DOM作成開始:', measurements)

    const container = document.createElement('div')
    container.style.cssText = `
      position: absolute;
      visibility: hidden;
      left: -9999px;
      top: -9999px;
      width: ${measurements.effectiveTextArea.width}px;
      height: ${measurements.effectiveTextArea.height}px;
      box-sizing: border-box;
      overflow: hidden;
    `
    container.setAttribute('data-real-measurement-container', '')

    // 実DOMから完全なスタイルをコピー
    const realTextArea = document.querySelector('[data-text-content]') as HTMLElement
    console.log('実テキストエリア検索結果:', realTextArea)

    if (realTextArea) {
      const computedStyle = window.getComputedStyle(realTextArea)

      // 重要なプロパティを優先的に移行
      const criticalProperties = [
        'font-size', 'line-height', 'font-family', 'letter-spacing',
        'writing-mode', 'text-orientation', 'direction',
        'white-space', 'word-break', 'overflow-wrap',
        'text-align', 'text-indent'
      ]

      criticalProperties.forEach(property => {
        const value = computedStyle.getPropertyValue(property)
        if (value) {
          container.style.setProperty(property, value)
        }
      })
    }

    document.body.appendChild(container)

    const textArea = document.createElement('div')
    textArea.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: hidden;
    `

    if (realTextArea) {
      const computedStyle = window.getComputedStyle(realTextArea)

      for (let i = 0; i < computedStyle.length; i++) {
        const property = computedStyle[i]
        const value = computedStyle.getPropertyValue(property)
        textArea.style.setProperty(property, value)
      }
    }

    container.appendChild(textArea)

    const measureFunction = async (text: string): Promise<MeasurementResult> => {
      textArea.textContent = text

      // DOM更新を確実にするために次のフレームで測定
      return new Promise<MeasurementResult>((resolve) => {
        requestAnimationFrame(async () => {
          const rect = textArea.getBoundingClientRect()
          const scrollWidth = textArea.scrollWidth
          const scrollHeight = textArea.scrollHeight
          const containerWidth = measurements.effectiveTextArea.width
          const containerHeight = measurements.effectiveTextArea.height

          console.log('測定中:', {
            text: text.substring(0, 50),
            scrollWidth,
            scrollHeight,
            containerWidth,
            containerHeight
          })

          // 縦書きの場合はscrollHeightが主要な判定基準
          const overflow = scrollHeight > containerHeight

          // オーバーフローしている場合のバイナリサーチ
          let fittingText = text
          if (overflow) {
            // バイナリサーチで収まる文字数を探す
            let left = 0
            let right = text.length
            let result = ''

            while (left <= right) {
              const mid = Math.floor((left + right) / 2)
              const testText = text.substring(0, mid)
              textArea.textContent = testText

              // DOM更新を待つ
              await new Promise(r => requestAnimationFrame(r))

              const testHeight = textArea.scrollHeight

              if (testHeight <= containerHeight) {
                result = testText
                left = mid + 1
              } else {
                right = mid - 1
              }
            }

            fittingText = result
          }

          resolve({
            overflow,
            characterCount: fittingText.length,
            textWidth: scrollWidth,
            textHeight: scrollHeight,
            actualText: fittingText
          })
        })
      })
    }

    const dispose = () => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }

    return {
      container,
      textArea,
      isReady: true,
      measure: measureFunction,
      dispose
    }
  }

  // findFittingTextメソッドは削除（measureFunction内に統合）

  public async calculatePages(blocks: TextBlock[]): Promise<Page[]> {
    if (!this.measurementDOM || !this.measurements) {
      throw new Error('測定DOMが初期化されていません')
    }

    console.log('ページ計算開始 - ブロック数:', blocks.length)
    console.log('測定エリアサイズ:', this.measurements.effectiveTextArea)

    const pages: Page[] = []
    let currentPageContent = ''
    let currentPageId = `page-${Date.now()}-${Math.random()}`
    let currentChapterTitle: string | undefined

    for (const block of blocks) {
      if (block.type === 'chapter') {
        // 章タイトルの場合
        if (currentPageContent) {
          // 既存のページをプッシュ
          pages.push({
            id: currentPageId,
            content: currentPageContent,
            chapterTitle: currentChapterTitle
          })
          currentPageContent = ''
          currentPageId = `page-${Date.now()}-${Math.random()}`
        }
        currentChapterTitle = block.chapterTitle
        continue
      }

      // 段落のインデントを追加
      const blockContent = block.type === 'paragraph'
        ? `　　${block.content}`
        : block.content

      const testContent = currentPageContent + (currentPageContent ? '' : '') + blockContent

      console.log(`測定中 - ブロック: ${block.id}, テキスト長: ${testContent.length}`)
      const measurementResult = await this.measurementDOM.measure(testContent)
      console.log('測定結果:', measurementResult)

      if (measurementResult.overflow && currentPageContent) {
        // 現在のページを保存
        pages.push({
          id: currentPageId,
          content: currentPageContent,
          chapterTitle: currentChapterTitle
        })

        // 新しいページを開始
        currentPageContent = blockContent
        currentPageId = `page-${Date.now()}-${Math.random()}`
        currentChapterTitle = undefined // 章タイトルは最初のページのみ

        // 新しいページでもオーバーフローする場合は分割
        const newMeasurement = await this.measurementDOM.measure(currentPageContent)
        if (newMeasurement.overflow) {
          // ブロック内分割が必要
          const fittingText = newMeasurement.actualText
          const remainingText = blockContent.substring(fittingText.length)

          pages.push({
            id: currentPageId,
            content: fittingText,
            chapterTitle: currentChapterTitle
          })

          // 残りテキストを次のページに
          currentPageContent = remainingText
          currentPageId = `page-${Date.now()}-${Math.random()}`
          currentChapterTitle = undefined
        }
      } else {
        // 現在のページに追加可能
        currentPageContent = measurementResult.actualText
      }
    }

    // 最後のページを追加
    if (currentPageContent) {
      console.log('最後のページを追加:', currentPageContent.substring(0, 50))
      pages.push({
        id: currentPageId,
        content: currentPageContent,
        chapterTitle: currentChapterTitle
      })
    }

    console.log(`ページ計算完了 - 総ページ数: ${pages.length}`)
    return pages
  }

  public dispose(): void {
    if (this.measurementDOM) {
      this.measurementDOM.dispose()
      this.measurementDOM = null
    }
  }
}

export function parseBookContent(content: string): TextBlock[] {
  console.log('書籍コンテンツ解析開始 - 文字数:', content.length)
  const lines = content.split('\n')
  const blocks: TextBlock[] = []
  let currentBlock = ''
  let blockId = 0

  for (const line of lines) {
    if (line.trim() === '') {
      if (currentBlock) {
        // 段落ブロックとして追加
        blocks.push({
          id: `block-${blockId++}`,
          type: 'paragraph',
          content: currentBlock.trim()
        })
        currentBlock = ''
      }
    } else if (line.match(/^第[一二三四五六七八九十\d]+章/)) {
      // 章タイトル
      if (currentBlock) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'paragraph',
          content: currentBlock.trim()
        })
        currentBlock = ''
      }

      blocks.push({
        id: `chapter-${blockId++}`,
        type: 'chapter',
        content: '',
        chapterTitle: line.trim()
      })
    } else if (line.startsWith('「') || line.startsWith('『')) {
      // 会話ブロック
      if (currentBlock) {
        blocks.push({
          id: `block-${blockId++}`,
          type: 'paragraph',
          content: currentBlock.trim()
        })
        currentBlock = ''
      }

      blocks.push({
        id: `conversation-${blockId++}`,
        type: 'conversation',
        content: line.trim()
      })
    } else {
      // 通常のテキスト行
      currentBlock += (currentBlock ? '' : '') + line
    }
  }

  if (currentBlock) {
    blocks.push({
      id: `block-${blockId++}`,
      type: 'paragraph',
      content: currentBlock.trim()
    })
  }

  console.log(`解析完了 - ブロック数: ${blocks.length}`)
  console.log('ブロック例:', blocks.slice(0, 3))

  return blocks
}