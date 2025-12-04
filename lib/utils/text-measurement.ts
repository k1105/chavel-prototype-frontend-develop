import type { TextMeasurement } from '@/types/pagination'

export class TextMeasurer {
  private measurementEl: HTMLDivElement | null = null
  private containerWidth = 0
  private containerHeight = 0
  private fontSize = 16
  private lineHeight = 1.6
  private fontFamily = 'system-ui, -apple-system, sans-serif'

  constructor(
    containerWidth: number,
    containerHeight: number,
    fontSize = 16,
    lineHeight = 1.6,
    fontFamily = 'system-ui, -apple-system, sans-serif',
  ) {
    this.containerWidth = containerWidth
    this.containerHeight = containerHeight
    this.fontSize = fontSize
    this.lineHeight = lineHeight
    this.fontFamily = fontFamily
    this.createMeasurementElement()
  }

  // Getterメソッドを追加
  get getContainerWidth(): number {
    return this.containerWidth
  }

  get getContainerHeight(): number {
    return this.containerHeight
  }

  get getFontSize(): number {
    return this.fontSize
  }

  get getLineHeight(): number {
    return this.lineHeight
  }

  private createMeasurementElement(): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      // 既存の測定要素があれば削除
      if (this.measurementEl && document.body.contains(this.measurementEl)) {
        document.body.removeChild(this.measurementEl)
      }

      // 非表示の測定用DOM要素を作成
      this.measurementEl = document.createElement('div')
      this.measurementEl.style.position = 'absolute'
      this.measurementEl.style.visibility = 'hidden'
      this.measurementEl.style.pointerEvents = 'none'
      this.measurementEl.style.top = '-9999px'
      this.measurementEl.style.left = '-9999px'
      this.measurementEl.style.width = `${this.containerWidth}px`
      this.measurementEl.style.maxHeight = `${this.containerHeight}px`
      this.measurementEl.style.overflow = 'hidden'
      this.measurementEl.style.fontSize = `${this.fontSize}px`
      this.measurementEl.style.lineHeight = `${this.lineHeight}`
      this.measurementEl.style.fontFamily = this.fontFamily
      this.measurementEl.style.whiteSpace = 'pre-wrap'
      this.measurementEl.style.wordWrap = 'break-word'
      this.measurementEl.style.padding = '0'
      this.measurementEl.style.margin = '0'
      this.measurementEl.style.border = 'none'

      document.body.appendChild(this.measurementEl)
    } catch (error) {
      console.warn('Failed to create measurement element:', error)
      this.measurementEl = null
    }
  }

  /**
   * 指定されたテキストがコンテナに収まる文字数を計算
   */
  measureText(text: string): TextMeasurement {
    if (!this.measurementEl) {
      throw new Error('Measurement element not initialized')
    }

    this.measurementEl.textContent = text
    const rect = this.measurementEl.getBoundingClientRect()

    const lineHeightPx = this.fontSize * this.lineHeight
    const lineCount = Math.ceil(rect.height / lineHeightPx)
    const charactersPerLine = Math.floor(this.containerWidth / this.getCharacterWidth())

    return {
      width: rect.width,
      height: rect.height,
      lineCount,
      charactersPerLine,
    }
  }

  /**
   * 1ページに収まる文字数を計算
   */
  getPageCapacity(): { charactersPerLine: number; linesPerPage: number; totalCharacters: number } {
    // コンテナサイズが無効な場合は0を返す
    if (this.containerWidth <= 0 || this.containerHeight <= 0) {
      console.warn('TextMeasurer.getPageCapacity: Invalid container size', {
        containerWidth: this.containerWidth,
        containerHeight: this.containerHeight,
      })
      return {
        charactersPerLine: 0,
        linesPerPage: 0,
        totalCharacters: 0,
      }
    }

    const lineHeightPx = this.fontSize * this.lineHeight
    const linesPerPage = Math.max(0, Math.floor(this.containerHeight / lineHeightPx))
    const characterWidth = this.getCharacterWidth()
    const charactersPerLine = Math.max(0, Math.floor(this.containerWidth / characterWidth))

    return {
      charactersPerLine,
      linesPerPage,
      totalCharacters: charactersPerLine * linesPerPage,
    }
  }

  /**
   * 指定された文字数のテキストが何行になるかを計算
   */
  calculateLines(text: string): number {
    if (!this.measurementEl) {
      throw new Error('Measurement element not initialized')
    }

    this.measurementEl.textContent = text
    const rect = this.measurementEl.getBoundingClientRect()
    const lineHeightPx = this.fontSize * this.lineHeight

    return Math.ceil(rect.height / lineHeightPx)
  }

  /**
   * テキストを1ページ分に切り詰める
   */
  fitTextToPage(text: string): { fittedText: string; remainingText: string } {
    const { totalCharacters, linesPerPage } = this.getPageCapacity()

    // 安全性チェック
    if (!text || text.length === 0 || totalCharacters <= 0 || linesPerPage <= 0) {
      return { fittedText: '', remainingText: text }
    }

    if (text.length <= totalCharacters) {
      return { fittedText: text, remainingText: '' }
    }

    // 簡略化されたアプローチ - 安全な文字数で切り詰める
    const safeCharacterCount = Math.max(1, Math.floor(totalCharacters * 0.8)) // 80%の安全マージン
    const cutPoint = Math.min(safeCharacterCount, text.length)

    // 文章の途中で切らないよう、句読点や空白で区切りを探す
    const punctuation = /[。！？\n\s]/g
    let lastGoodCut = cutPoint

    for (let i = cutPoint; i > cutPoint * 0.7 && i > 0; i--) {
      if (punctuation.test(text[i])) {
        lastGoodCut = i + 1
        break
      }
    }

    // 最終的な切り取り位置を決定
    const finalCutPoint = lastGoodCut > 0 ? lastGoodCut : Math.max(1, cutPoint)

    return {
      fittedText: text.substring(0, finalCutPoint),
      remainingText: text.substring(finalCutPoint),
    }
  }

  /**
   * 平均的な文字幅を計算（日本語文字を考慮）
   */
  private getCharacterWidth(): number {
    if (!this.measurementEl) return this.fontSize * 0.6

    // 日本語と英数字の混合テキストで平均文字幅を計算
    const testText = 'あいうえおABCDE12345'
    this.measurementEl.textContent = testText
    const width = this.measurementEl.getBoundingClientRect().width

    return width / testText.length
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    if (this.measurementEl && document.body.contains(this.measurementEl)) {
      document.body.removeChild(this.measurementEl)
      this.measurementEl = null
    }
  }

  /**
   * 設定を更新
   */
  updateSettings(settings: {
    containerWidth?: number
    containerHeight?: number
    fontSize?: number
    lineHeight?: number
    fontFamily?: string
  }): void {
    if (settings.containerWidth !== undefined) this.containerWidth = settings.containerWidth
    if (settings.containerHeight !== undefined) this.containerHeight = settings.containerHeight
    if (settings.fontSize !== undefined) this.fontSize = settings.fontSize
    if (settings.lineHeight !== undefined) this.lineHeight = settings.lineHeight
    if (settings.fontFamily !== undefined) this.fontFamily = settings.fontFamily

    this.createMeasurementElement()
  }
}
