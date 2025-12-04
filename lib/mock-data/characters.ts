import type { Character, BookCharacters } from '@/types/character'
import wagahaiCharactersData from './wagahai.characters.json'

// 新しいキャラクターデータ取得関数
export function getCharactersByBookId(bookId: string): Character[] {
  switch (bookId) {
    case '1':
      return (wagahaiCharactersData as BookCharacters).characters
    default:
      return []
  }
}
