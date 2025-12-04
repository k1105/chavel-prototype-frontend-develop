# Chavel - インタラクティブ電子書籍プロトタイプ

## 概要
Chavelは、電子書籍の読書体験を革新的に変えるiPad向けプロトタイプアプリケーションです。従来の電子書籍リーダーの機能に加え、AIを活用して書籍内のキャラクターと実際に会話できる読書体験を提供します。

## 主要機能
- 📚 **電子書籍リーダー**: Kindleライクな快適な読書インターフェース
- 🤖 **AI キャラクター対話**: 書籍内のキャラクターをAIで人格化し、非同期通信で会話
- 📱 **シングルページアプリ**: 書籍一覧とリーダー/チャット画面の2画面構成

## 技術スタック
- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **コード品質**: Biome（リント・フォーマット統合ツール）
- **APIサーバー**: 別プロジェクトで実装（AI対話処理）
- **開発環境**: ローカルホスト実行

## セットアップ

### 前提条件
- Node.js 18.x 以上
- npm / yarn / pnpm
- Git

### インストール
```bash
# リポジトリのクローン
git clone [repository-url]
cd chavel-prototype-frontend

# 依存関係のインストール（npm または yarn）
npm install
# または
yarn install

# 環境変数の設定
cp .env.example .env.local
# .env.localに必要な環境変数を設定

# 開発サーバーの起動
npm run dev
# または
yarn dev
```

### 環境変数
```
# 外部APIサーバーのURL
EXTERNAL_API_URL=http://localhost:8000
```

## APIサーバーとの連携

このフロントエンドアプリケーションは、Next.js API Routerを介して外部APIサーバーと通信します。

### セキュリティ設計
- クライアント → Next.js API Router → 外部APIサーバー
- API Routerでセキュリティ処理を一元化

### API Routes（/app/api/）
- `/api/chat` - キャラクターとの対話
- `/api/characters` - キャラクター情報取得
- `/api/books` - 書籍データ管理

## 開発

### ディレクトリ構造
```
├── app/              # Next.js App Router
│   ├── page.tsx     # シングルページアプリ（書籍一覧・リーダー・チャット）
│   ├── _components/ # ページコンポーネント
│   │   ├── book-list.tsx    # 書籍一覧画面
│   │   ├── book-reader.tsx  # リーダー画面
│   │   └── chat-panel.tsx   # チャットパネル
│   ├── api/         # API Routes（外部APIへのプロキシ）
│   │   ├── books/
│   │   ├── characters/
│   │   └── chat/
│   └── layout.tsx   # ルートレイアウト
├── components/       # 汎用的なUIコンポーネント（Atomic Design）
│   ├── ui/          # 基本UIコンポーネント
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   └── common/      # 共通コンポーネント
├── lib/             # ユーティリティ関数
├── hooks/           # カスタムフック
├── services/        # APIクライアント（API Routerを呼び出す）
├── types/           # TypeScript型定義
├── public/          # 静的アセット
└── styles/          # グローバルスタイル
```

**ファイル命名規則**: すべてのTypeScript/TSXファイルはケバブケース（kebab-case.tsx）

### スクリプト
```bash
# 開発サーバー起動
npm run dev      # または yarn dev

# プロダクションビルド
npm run build    # または yarn build

# プロダクションサーバー起動（ローカル）
npm run start    # または yarn start

# Biome（リント・フォーマット）
npm run lint     # または yarn lint
npm run format   # または yarn format

# TypeScript型チェック
npm run type-check  # または yarn type-check
```

## ライセンス
[ライセンスタイプを記載]

## コントリビューション
[コントリビューションガイドラインを記載]