export interface BookData {
  metadata: {
    id: number
    title: string
    author: string
  }
  content: {
    chapters: Array<{
      id: number
      title: string
      blocks: Array<{
        id: number
        type: string
        text: string
      }>
    }>
  }
}