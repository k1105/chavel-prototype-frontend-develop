interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  characterId?: string
  characterName?: string
}

interface ChatRequest {
  book_id: string
  character_id: number | null
  pos: number
  question: string
  history: {
    character_id: number
    message: string
  }[]
}

interface ChatResponse {
  answer: string[]
}

export class ChatService {
  private static readonly API_BASE_URL = '/api'

  /**
   * キャラクターとチャットする（新フォーマット）
   */
  static async chatWithCharacter(request: {
    bookId: string
    characterId: number
    characterName: string
    message: string
    position: number
    messageHistory: ChatMessage[]
  }): Promise<ChatMessage[]> {
    try {
      console.log('Sending chat request:', request)

      // 新しいAPIフォーマットに変換
      const apiRequest: ChatRequest = {
        book_id: request.bookId,
        character_id: request.characterId,
        pos: request.position,
        question: request.message,
        history: request.messageHistory
          .map(msg => ({
            // ユーザーの発言の場合は0、キャラクターの発言の場合はそのID
            character_id: msg.role === 'user' ? 0 : parseInt(msg.characterId || '0'),
            message: msg.content
          }))
      }

      const response = await fetch(`${this.API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequest),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data: ChatResponse = await response.json()
      console.log('Received chat response:', data)

      // レスポンス配列を順次ChatMessage形式に変換
      const chatMessages: ChatMessage[] = []
      const baseTimestamp = Date.now()

      for (let i = 0; i < data.answer.length; i++) {
        const message = data.answer[i]
        const chatMessage: ChatMessage = {
          id: `${baseTimestamp}_${request.characterId}_${i}`,
          role: 'assistant',
          content: message,
          timestamp: new Date(baseTimestamp + (i * 500)), // 500ms間隔でタイムスタンプを設定
          characterId: request.characterId.toString(),
          characterName: request.characterName,
        }
        chatMessages.push(chatMessage)
      }

      return chatMessages

    } catch (error) {
      console.error('Chat service error:', error)

      // エラー時のフォールバック応答
      const fallbackMessage: ChatMessage = {
        id: `${Date.now()}_error`,
        role: 'assistant',
        content: 'すみません、今お話しできません。少し時間をおいてからもう一度お試しください。',
        timestamp: new Date(),
        characterId: request.characterId.toString(),
        characterName: request.characterName,
      }

      return [fallbackMessage]
    }
  }

  /**
   * メッセージを順次表示するためのヘルパー関数
   */
  static async *processMessagesSequentially(
    messages: ChatMessage[],
    delayMs = 500
  ): AsyncGenerator<ChatMessage, void, unknown> {
    for (const message of messages) {
      yield message
      if (messages.indexOf(message) < messages.length - 1) {
        // 最後のメッセージでなければ遅延を入れる
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  /**
   * チャット履歴を API リクエスト形式に変換
   */
  static convertMessagesToHistory(messages: ChatMessage[]) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      characterId: msg.characterId,
      characterName: msg.characterName,
    }))
  }

  /**
   * 接続テスト
   */
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/chat`, {
        method: 'OPTIONS',
      })
      return response.ok || response.status === 405 // OPTIONS may not be implemented
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }
}

// タイプエクスポート
export type { ChatMessage, ChatRequest, ChatResponse }