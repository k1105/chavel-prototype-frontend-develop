export interface PagePosition {
  chapterId: number
  blockId: number
  characterStart: number
  characterEnd: number
}

export interface Page {
  id: number
  position: PagePosition
  content: string[]
  totalCharacters: number
}

export interface PaginationState {
  currentPageIndex: number
  totalPages: number
  pages: Page[]
  containerWidth: number
  containerHeight: number
  fontSize: number
  lineHeight: number
  charactersPerLine: number
  linesPerPage: number
}

export interface TextMeasurement {
  width: number
  height: number
  lineCount: number
  charactersPerLine: number
}

export interface BookContent {
  id: number
  title: string
  author: string
  chapters: Chapter[]
}

export interface Chapter {
  id: number
  title: string
  blocks: Block[]
}

export interface Block {
  id: number
  type: 'paragraph' | 'conversation'
  text: string
}
