import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chavel - インタラクティブ電子書籍',
  description: 'AIキャラクターと対話できる電子書籍リーダー',
  themeColor: '#00c300',
  other: {
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="theme-color" content="#00c300" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="msapplication-navbutton-color" content="#00c300" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
