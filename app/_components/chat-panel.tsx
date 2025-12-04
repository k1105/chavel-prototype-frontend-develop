'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { getCharactersByBookId } from '@/lib/mock-data/characters'
import type { Character } from '@/types/character'
import { ChatService } from '@/services/chat-service'
import type { ChatMessage } from '@/services/chat-service'
import { mockBooks } from '@/lib/mock-data/books'

interface ChatPanelProps {
  bookId: string
  isExpanded: boolean
  onToggleExpand: () => void
  showReaderControls?: boolean  // リーダーのコントロール表示状態
  currentPageInfo?: {
    currentPageIndex: number
    totalPages: number
    currentChapterTitle?: string
    currentChapterId?: number
    currentBlockId?: number
    currentCharacterOffset?: number
    currentPosition?: number  // 累積文字位置を追加
  }
}

// ChatServiceのChatMessage型を使用
type Message = ChatMessage

export default function ChatPanel({ bookId, isExpanded, onToggleExpand, showReaderControls = false, currentPageInfo }: ChatPanelProps) {
  // 新しいキャラクターデータを取得
  const allCharacters = getCharactersByBookId(bookId)

  // 現在のページに基づいてキャラクターをフィルタリング
  const availableCharacters = allCharacters.filter(character => {
    if (!currentPageInfo) return true // ページ情報がない場合は全て表示

    // キャラクターの出現タイミングと現在のページ位置を比較
    const appearance = character.appearance
    const currentChapter = currentPageInfo.currentChapterId || 1
    const currentBlock = currentPageInfo.currentBlockId || 1

    // 章の比較
    if (appearance.chapter > currentChapter) {
      return false // まだ出現章に到達していない
    }

    if (appearance.chapter < currentChapter) {
      return true // 過去の章で出現済み
    }

    // 同じ章の場合（appearance.chapter === currentChapter）
    if (appearance.block > currentBlock) {
      return false // まだ出現ブロックに到達していない
    }

    if (appearance.block < currentBlock) {
      return true // 同じ章の過去のブロックで出現済み
    }

    // 同じブロックの場合（appearance.block === currentBlock）
    const currentOffset = currentPageInfo.currentCharacterOffset || 0

    // characterOffsetが未指定の場合はブロック到達時点で出現
    if (appearance.characterOffset === undefined) {
      return true
    }

    // characterOffsetが指定されている場合、ブロック内のオフセットで比較
    return currentOffset >= appearance.characterOffset
  })

  const characters = availableCharacters

  const [selectedCharacter, setSelectedCharacter] = useState<string>(
    characters.length > 0 ? characters[0].id.toString() : ''
  )

  // 利用可能なキャラクターが変更された時に選択キャラクターを調整
  useEffect(() => {
    if (characters.length === 0) {
      setSelectedCharacter('')
    } else {
      // 現在選択中のキャラクターが利用可能でない場合、最初の利用可能キャラクターに変更
      const currentCharacterAvailable = characters.some(char => char.id.toString() === selectedCharacter)
      if (!currentCharacterAvailable) {
        setSelectedCharacter(characters[0].id.toString())
      }
    }
  }, [characters, selectedCharacter])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [viewportHeight, setViewportHeight] = useState('100dvh')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)


  // 最新メッセージにスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // メッセージが更新されたら最下部にスクロール
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // スクロール防止
  const preventScroll = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      document.body.scrollTop = 0
      document.documentElement.scrollTop = 0
    }
  }

  // バーチャルキーボード対応
  const handleTextareaFocus = () => {
    setIsInputFocused(true)
    // フォーカス時にスクロールを防止
    preventScroll()

    // キーボード高さに合わせて調整
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const height = window.visualViewport.height
        setViewportHeight(`${height}px`)
      }
      // 調整後もスクロールを防止
      setTimeout(preventScroll, 50)
      // 最新メッセージにスクロール
      setTimeout(scrollToBottom, 200)
    }, 150)
  }

  const handleTextareaBlur = () => {
    setIsInputFocused(false)
    // ブラー時は通常の高さに戻す
    setTimeout(() => {
      setViewportHeight('100dvh')
      preventScroll()
    }, 150)
  }

  // Safariのメニューバー変化に対応
  useEffect(() => {
    if (!isExpanded) return // チャット未展開時は無効

    const handleViewportChange = () => {
      if (typeof window !== 'undefined' && window.visualViewport && !isInputFocused) {
        // キーボードフォーカス中でない場合のみ更新
        const height = window.visualViewport.height
        setViewportHeight(`${height}px`)
      }
    }

    // visualViewport変化の監視
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
    }

    return () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
      }
    }
  }, [isExpanded, isInputFocused])

  // スクロール監視 - チャット展開時は無効
  useEffect(() => {
    if (!isExpanded) return // チャット展開時はスクロール防止を無効化

    let scrollTimer: NodeJS.Timeout

    const handleScroll = () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(preventScroll, 10)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: false })
      document.addEventListener('scroll', handleScroll, { passive: false })

      return () => {
        window.removeEventListener('scroll', handleScroll)
        document.removeEventListener('scroll', handleScroll)
        clearTimeout(scrollTimer)
      }
    }
  }, [isExpanded])

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    // 選択されたキャラクター名を取得
    const selectedChar = characters.find(char => char.id.toString() === selectedCharacter)
    const characterName = selectedChar ? selectedChar.name : 'キャラクター'
    const characterId = selectedChar ? selectedChar.id : 1

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `@${characterName} ${inputMessage}`,
      timestamp: new Date(),
      characterId: selectedCharacter,
      characterName: characterName,
    }

    setMessages((prev) => [...prev, userMessage])
    const currentMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)

    try {
      // 現在の位置情報を取得（デフォルトは0）
      const currentPosition = currentPageInfo?.currentPosition || 0

      // APIサービスを使用してチャット
      const chatResponses = await ChatService.chatWithCharacter({
        bookId: bookId,
        characterId: characterId,
        characterName: characterName,
        message: currentMessage,
        position: currentPosition,
        messageHistory: messages
      })

      // メッセージを順次表示
      for await (const message of ChatService.processMessagesSequentially(chatResponses, 500)) {
        setMessages((prev) => [...prev, message])
        // 最後のメッセージでなければスクロールして少し待つ
        if (chatResponses.indexOf(message) < chatResponses.length - 1) {
          setTimeout(scrollToBottom, 100)
        }
      }

    } catch (error) {
      console.error('Chat error:', error)

      // エラー時のフォールバック応答
      const errorMessage: Message = {
        id: `${Date.now()}_error`,
        role: 'assistant',
        content: 'すみません、今お話しできません。少し時間をおいてからもう一度お試しください。',
        timestamp: new Date(),
        characterId: selectedCharacter,
        characterName: characterName,
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isExpanded) {
    // Collapsed state: show only Chavel logo centered
    return (
      <div
        className={`h-full flex items-center justify-center bg-primary-50 rounded-t-3xl transition-transform duration-300 relative ${
          showReaderControls ? 'translate-y-full' : 'translate-y-0'
        }`}
        onClick={onToggleExpand}
      >
        {/* 上向き三角形 */}
        <div className={`absolute -top-5 left-1/2 transform -translate-x-1/2 transition-transform duration-300 origin-bottom ${
          showReaderControls ? 'scale-0' : 'scale-100'
        }`}>
          <svg width="36" height="20" viewBox="0 0 36 20" className="fill-primary-50 transition-all duration-300">
            <path d="M18 0L0 20H36L18 0Z" />
          </svg>
        </div>

        <div className="w-[21%]">
          <Image
            src="/images/chavel-logo.png"
            alt="Chavel"
            width={100}
            height={67}
            className="w-full h-auto opacity-90 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed top-[50px] left-0 right-0 bottom-0 rounded-t-3xl transform transition-all duration-300 ease-out overflow-hidden"
      style={{
        backgroundColor: 'rgba(249, 228, 183, 0.6)',
        height: viewportHeight === '100dvh'
          ? 'calc(100dvh - 50px)'
          : `calc(${viewportHeight} - 50px)`,
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      {/* 下向き三角形（チャットエリア上部） */}
      <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 transition-transform duration-300 origin-top ${
        showReaderControls ? 'scale-0' : 'scale-100'
      }`}>
        <svg width="36" height="20" viewBox="0 0 36 20" className="fill-white transition-all duration-300">
          <path d="M18 20L0 0H36L18 20Z" />
        </svg>
      </div>

      {/* Logo at top center (same as collapsed state) */}
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
        <div className="w-[21vw]">
          <Image
            src="/images/chavel-logo.png"
            alt="Chavel"
            width={100}
            height={67}
            className="w-full h-auto opacity-90"
          />
        </div>
      </div>

      {/* Floating collapse button */}
      <button
        onClick={onToggleExpand}
        className="absolute top-4 right-4 z-50 bg-white/80 backdrop-blur-sm rounded-full p-2 text-gray-600 hover:text-gray-800 hover:bg-white/90 shadow-sm transition-all duration-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>


      {/* Chat Messages - Full height */}
      <div
        className="absolute overflow-y-auto"
        data-chat-messages
        style={{
          top: '8rem',
          left: 0,
          right: 0,
          bottom: '11rem', // 11rem + 3rem (約50px) のマージンを追加
          padding: '2rem',
          paddingBottom: '6rem',
          touchAction: 'pan-y', // 縦スクロールを許可
          WebkitOverflowScrolling: 'touch' // iOS Safari用のスムーススクロール
        }}
        onTouchMove={(e) => e.stopPropagation()} // 親のタッチイベントをブロック
      >
        {/* メッセージが空の時のプレースホルダー */}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/60 text-center text-lg">
              話したいキャラクターを選んでメッセージを送りましょう
            </p>
          </div>
        )}
        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          const displayName = isUser ? 'あなた' : (message.characterName || 'キャラクター')

          // アイコン画像を取得
          const getCharacterIcon = (characterId: string) => {
            const book = mockBooks.find(b => b.id === bookId)
            const iconMapping = book?.characterIconMap?.find(mapping => mapping.id === parseInt(characterId))
            return iconMapping ? `/images/wagahai/${iconMapping.fileName}` : '/images/user-unknown.png'
          }

          const iconSrc = isUser ? '/images/user-you.png' : getCharacterIcon(message.characterId || '')

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-[11px]`}
              style={{
                marginLeft: isUser ? '4rem' : 0,
                marginRight: isUser ? 0 : '4rem',
                marginBottom: index < messages.length - 1 ? '1rem' : 0
              }}
            >
              {/* アイコン */}
              <div className="shrink-0 self-end" style={{ marginBottom: 'calc(1rem + 0.25rem)' }}>
                <div className="w-16 h-16 rounded-full overflow-hidden">
                  <Image
                    src={iconSrc}
                    alt={displayName}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* メッセージコンテナ */}
              <div className={`flex flex-col flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* 名前 */}
                <p className={`text-xs text-gray-600 mb-1 ${isUser ? 'text-right' : 'text-left'}`}>
                  {displayName}
                </p>

                {/* バルーンコンテナ */}
                <div className={`flex ${isUser ? 'flex-row-reverse translate-x-4' : 'flex-row'} items-start gap-0 w-full`}>
                  {/* 接続部分 */}
                  <div className='flex flex-col self-stretch'
                    style={{
                      // transform: isUser? 'translateX(-1px)': 'translateX(1px)',
                    }}
                  >
                    <div
                      className="flex-1 w-9 min-h-9"
                      style={{
                        backgroundColor: isUser ? 'var(--primary)' : 'var(--surface)',
                        borderRadius: isUser
                        ? '0 36px 0 0'  // ユーザー側：右上のみ角丸
                        : '36px 0 0 0',  // アシスタント側：左上のみ角丸
                        transform: isUser? 'translateX(-16px)': 'translateX(0px)',
                      }}
                    />
                    <div
                      className="shrink-0 w-5 h-5 mb-9"
                      style={{
                        clipPath: isUser? 'polygon(0 0, 100% 0, 100% 100%)': 'polygon(0 0, 100% 0, 0 100%)',
                        backgroundColor: isUser ? 'var(--primary)' : 'var(--surface)', }}
                    />
                  </div>

                  {/* バルーン */}
                  <div
                    className="pl-10 pr-5 py-9 text-black flex items-center flex-1"
                    style={{
                      backgroundColor: isUser ? 'var(--primary)' : 'var(--surface)',
                      borderRadius: isUser
                        ? '36px 18px 36px 36px'  // 右上のみ角ばる
                        : '18px 36px 36px 36px',  // 左上のみ角ばる
                      paddingLeft: isUser ? '2.25rem' : '1.25rem',
                      paddingRight: isUser ? '1.25rem' : '2.25rem',
                      transform: !isUser? 'translateX(-16px)': 'translateX(0px)',
                    }}
                  >
                    <p className="whitespace-pre-wrap text-2xl">
                      {(() => {
                        if (!isUser || !message.content.startsWith('@')) {
                          return message.content;
                        }

                        // キャラクター名とメッセージを分離するための処理
                        const content = message.content;
                        const characterName = message.characterName;

                        if (characterName) {
                          const expectedMention = `@${characterName}`;
                          if (content.startsWith(expectedMention)) {
                            const restOfMessage = content.slice(expectedMention.length).trim();
                            return (
                              <>
                                <span className="text-white font-semibold">
                                  {expectedMention}
                                </span>
                                {restOfMessage && (
                                  <>
                                    {' '}
                                    {restOfMessage}
                                  </>
                                )}
                              </>
                            );
                          }
                        }

                        // フォールバック: 従来の方法
                        return (
                          <>
                            <span className="text-white font-semibold">
                              {content.split(' ')[0]}
                            </span>
                            {' '}
                            {content.split(' ').slice(1).join(' ')}
                          </>
                        );
                      })()}
                    </p>
                  </div>
                </div>

                {/* タイムスタンプ */}
                <p className={`text-xs mt-1 text-gray-500 ${isUser ? 'text-right' : 'text-left'}`}>
                  {message.timestamp.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
        {/* 自動スクロール用の要素 */}
        <div ref={messagesEndRef} />
      </div>

      {/* Clear Chat History Button */}
      <button
        onClick={() => setMessages([])}
        className="absolute right-4 z-30 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-white/90 shadow-sm transition-all duration-200"
        style={{
          bottom: '16rem' // 入力エリアから少し上に配置
        }}
      >
        履歴をクリア
      </button>

      {/* Input Panel - Combined overlay */}
      <div className="absolute inset-0 pointer-events-none z-40">
        <div className="absolute left-0 right-0 pointer-events-auto transition-all duration-300" style={{ bottom: isInputFocused ? '0px' : '0px' }}>
          {/* Character Selection */}
          <div className="p-4 backdrop-blur-sm shadow-lg" style={{ backgroundColor: '#eff3f6', borderTop: '1.5px solid black' }}>
            <div
              className="flex gap-2 overflow-x-auto scrollbar-hide"
              data-character-selection
              style={{
                touchAction: 'pan-x',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {characters.map((character) => (
                <button
                  key={character.id}
                  onClick={() => setSelectedCharacter(character.id.toString())}
                  className={`px-3 py-1 rounded-full whitespace-nowrap text-[22px] h-[40px] transition-colors duration-150 ${
                    selectedCharacter === character.id.toString()
                      ? 'bg-primary text-white'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {character.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="py-8 px-4 backdrop-blur-sm" style={{ backgroundColor: '#eff3f6', borderTop: '1.5px solid black' }}>
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                {/* ボーダー付き親要素 */}
                <div className="rounded-lg bg-white focus-within:ring-2 focus-within:ring-primary transition-all duration-150 min-h-[100px] overflow-hidden" style={{ border: '1.5px solid black' }}>
                  {/* メンション表示 */}
                  {selectedCharacter && (
                    <div className="px-4 py-2 bg-white pointer-events-none">
                      <span className="text-primary font-semibold text-sm">
                        @{characters.find(char => char.id.toString() === selectedCharacter)?.name}
                      </span>
                    </div>
                  )}
                  {/* テキストエリア（ボーダーなし） */}
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onFocus={handleTextareaFocus}
                    onBlur={handleTextareaBlur}
                    placeholder="メッセージを入力..."
                    className="w-full px-4 py-3 focus:outline-none resize-none bg-transparent"
                    style={{
                      minHeight: selectedCharacter ? '60px' : '100px',
                      maxHeight: '128px'
                    }}
                    disabled={isLoading}
                    rows={1}
                  />
                </div>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 h-[54px] text-[20px] self-end transform translate-y-[-6px]"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
