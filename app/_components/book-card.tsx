'use client'

import Image from 'next/image'
import { useState } from 'react'

interface BookCardProps {
  book: {
    id: string
    title: string
    author: string
    cover: string
  }
  onClick: () => void
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const [imgSrc, setImgSrc] = useState(book.cover)

  return (
    <div
      className="cursor-pointer transform transition-all hover:scale-105"
      onClick={onClick}
    >
      <div className="bg-white overflow-hidden">
        <div className="aspect-[185/262] bg-gray-200 relative">
          <Image
            src={imgSrc}
            alt={book.title}
            fill
            className="object-cover"
          />
        </div>
      </div>
    </div>
  )
}
