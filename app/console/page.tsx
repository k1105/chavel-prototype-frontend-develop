'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConsolePage() {
  const router = useRouter()
  const [swipeSettings, setSwipeSettings] = useState({
    autoCompleteThreshold: 0.5,
    slideStartThreshold: 20
  })

  const [uiSettings, setUiSettings] = useState({
    showNavigationButtons: true
  })

  // localStorageから設定を読み込み
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chavel-swipe-settings')
      if (saved) {
        setSwipeSettings(JSON.parse(saved))
      }

      const uiSaved = localStorage.getItem('chavel-ui-settings')
      if (uiSaved) {
        setUiSettings(JSON.parse(uiSaved))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }, [])

  // 設定をlocalStorageに保存
  const saveSettings = (newSettings: typeof swipeSettings) => {
    setSwipeSettings(newSettings)
    localStorage.setItem('chavel-swipe-settings', JSON.stringify(newSettings))
  }

  const saveUiSettings = (newSettings: typeof uiSettings) => {
    setUiSettings(newSettings)
    localStorage.setItem('chavel-ui-settings', JSON.stringify(newSettings))
  }

  // 設定をリセット
  const resetSettings = () => {
    const defaultSwipeSettings = {
      autoCompleteThreshold: 0.5,
      slideStartThreshold: 20
    }
    const defaultUiSettings = {
      showNavigationButtons: true
    }
    saveSettings(defaultSwipeSettings)
    saveUiSettings(defaultUiSettings)
  }

  return (
    <div className="min-h-screen bg-primary-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">開発者コンソール</h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            戻る
          </button>
        </div>

        {/* スワイプ設定セクション */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">スワイプ設定</h2>

          <div className="space-y-6">
            {/* 自動完了閾値 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自動完了閾値: {(swipeSettings.autoCompleteThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={swipeSettings.autoCompleteThreshold}
                onChange={(e) => saveSettings({
                  ...swipeSettings,
                  autoCompleteThreshold: Number(e.target.value)
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                この割合まで引っ張るとページが自動で切り替わります
              </p>
            </div>

            {/* スワイプ開始閾値 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                スワイプ開始閾値: {swipeSettings.slideStartThreshold}px
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={swipeSettings.slideStartThreshold}
                onChange={(e) => saveSettings({
                  ...swipeSettings,
                  slideStartThreshold: Number(e.target.value)
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                この距離以上スワイプするとページ送りが開始されます
              </p>
            </div>
          </div>

          {/* リセットボタン */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={resetSettings}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              設定をリセット
            </button>
          </div>
        </div>

        {/* UI設定セクション */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">UI設定</h2>

          <div className="space-y-6">
            {/* ナビゲーションボタン表示設定 */}
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={uiSettings.showNavigationButtons}
                  onChange={(e) => saveUiSettings({
                    ...uiSettings,
                    showNavigationButtons: e.target.checked
                  })}
                  className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  ページナビゲーションボタンを表示
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                画面左右のページ送りボタンの表示・非表示を切り替えます
              </p>
            </div>
          </div>
        </div>

        {/* 現在の設定値表示 */}
        <div className="bg-gray-100 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-2">現在の設定値</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>自動完了閾値: {swipeSettings.autoCompleteThreshold}</p>
            <p>スワイプ開始閾値: {swipeSettings.slideStartThreshold}px</p>
            <p>ナビゲーションボタン: {uiSettings.showNavigationButtons ? '表示' : '非表示'}</p>
          </div>
        </div>

        {/* 使用方法 */}
        <div className="bg-blue-50 rounded-lg p-4 mt-6">
          <h3 className="text-lg font-medium text-blue-800 mb-2">使用方法</h3>
          <div className="text-sm text-blue-600 space-y-1">
            <p>• 自動完了閾値: ページ幅に対する割合（0.1 = 10%, 0.5 = 50%）</p>
            <p>• スワイプ開始閾値: スワイプを開始するのに必要な最小距離（ピクセル）</p>
            <p>• 設定は自動的にlocalStorageに保存されます</p>
          </div>
        </div>
      </div>
    </div>
  )
}