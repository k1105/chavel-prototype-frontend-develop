'use client'

import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true)
      // フェードアウトアニメーション完了後にコールバック実行
      setTimeout(() => {
        setIsVisible(false)
        onFinish()
      }, 500)
    }, 3000)

    return () => clearTimeout(timer)
  }, [onFinish])

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={`fixed inset-0 bg-white flex items-center justify-center z-[9999] transition-opacity duration-500 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <img src="/images/chavel-logo.png" alt="Chavel" className="w-1/2 h-auto" />
    </div>
  )
}