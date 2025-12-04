'use client'

import { mockBooks } from '@/lib/mock-data/books'
import BookCard from './book-card'

interface BookListProps {
  onBookSelect: (bookId: string) => void
}

export default function BookList({ onBookSelect }: BookListProps) {
  // 3列ごとにグルーピング
  const booksPerRow = 3
  const rows = []
  for (let i = 0; i < mockBooks.length; i += booksPerRow) {
    rows.push(mockBooks.slice(i, i + booksPerRow))
  }

  return (
    <main className="min-h-screen bg-primary-50 flex justify-center">
      <div className="w-[85%] pb-0 mt-[15vh]">
        <div className="bg-white rounded-t-lg min-h-full pt-[12%] pb-8">
          <div>
            {rows.map((rowBooks, rowIndex) => (
              <div key={rowIndex}>
                <div className={`grid grid-cols-3 gap-[9%] px-[6.6%] ${rowIndex === 0 ? 'pt-[33px]' : 'pt-[99px]'}`}>
                  {rowBooks.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onClick={() => !book.disabled && onBookSelect(book.id)}
                    />
                  ))}
                  {/* 行の残りのセルを埋める */}
                  {rowBooks.length < booksPerRow && Array.from({ length: booksPerRow - rowBooks.length }).map((_, index) => (
                    <div key={`empty-${index}`} />
                  ))}
                </div>
                {/* 横線を追加（幅いっぱい） */}
                <div className="w-full bg-primary h-[33px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
