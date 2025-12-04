export interface Character {
  id: number
  name: string
  appearance: {
    chapter: number
    block: number
    characterOffset: number
  }
}

export interface BookCharacters {
  characters: Character[]
}