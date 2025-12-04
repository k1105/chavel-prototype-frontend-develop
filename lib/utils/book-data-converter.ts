// wagahai.jsonを直接import
import wagahaiData from '@/lib/mock-data/wagahai.json'
import type { BookContent } from '@/types/pagination'

/**
 * wagahai.json形式のデータをBookContent形式に変換
 */
export function convertWagahaiToBookContent(wagahaiData: any): BookContent {
  return {
    id: wagahaiData.metadata.id,
    title: wagahaiData.metadata.title,
    author: wagahaiData.metadata.author,
    chapters: wagahaiData.content.chapters.map((chapter: any) => ({
      id: chapter.id,
      title: chapter.title,
      blocks: chapter.blocks.map((block: any) => ({
        id: block.id,
        type: block.type as 'paragraph' | 'conversation',
        text: block.text,
      })),
    })),
  }
}

/**
 * wagahai.jsonデータを読み込む
 */
export function loadWagahaiBook(): BookContent {
  try {
    return convertWagahaiToBookContent(wagahaiData)
  } catch (error) {
    console.error('Failed to load wagahai book data:', error)

    // フォールバック用のダミーデータ
    return {
      id: 1,
      title: 'サンプル書籍',
      author: 'サンプル著者',
      chapters: [
        {
          id: 1,
          title: '第一章',
          blocks: [
            {
              id: 1,
              type: 'paragraph',
              text: 'これはサンプルテキストです。実際のデータが読み込めない場合に表示されます。',
            },
          ],
        },
      ],
    }
  }
}
