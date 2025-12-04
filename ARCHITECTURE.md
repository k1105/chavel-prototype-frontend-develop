# アーキテクチャ設計書

## 1. システム全体構成

### 1.1 アーキテクチャ概要
```
┌──────────────────────────────────────────────────────────┐
│                   iPad Client (Browser)                    │
│                  http://localhost:3000                     │
├──────────────────────────────────────────────────────────┤
│                          ↓ HTTP                            │
├──────────────────────────────────────────────────────────┤
│                  Next.js API Router                        │
│                 (セキュリティ・プロキシ層)                   │
├──────────────────────────────────────────────────────────┤
│                          ↓ HTTP                            │
├──────────────────────────────────────────────────────────┤
│                    External API Server                     │
│                  http://localhost:8000                     │
│              (別プロジェクトで実装・AI処理担当)              │
└──────────────────────────────────────────────────────────┘
```

**注**: このプロジェクトはフロントエンド部分のみ実装。AI対話処理は別プロジェクトのAPIサーバーが担当。

### 1.2 技術スタック詳細

#### フロントエンド（本プロジェクト）
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 3.x
- **State Management**: Zustand
- **Data Fetching**: TanStack Query v5
- **Code Quality**: Biome（リント・フォーマット統合）
- **Forms**: React Hook Form + Zod
- **ローカルストレージ**: IndexedDB / LocalStorage

#### APIサーバー（別プロジェクト）
- AI対話処理
- キャラクター管理
- 書籍データ管理
※ 詳細は別プロジェクトのドキュメントを参照

## 2. フロントエンドアーキテクチャ

### 2.1 ディレクトリ構造
```
chavel-prototype-frontend/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # ルートレイアウト
│   ├── page.tsx             # シングルページアプリ
│   ├── _components/         # ページコンポーネント
│   │   ├── book-list.tsx       # 書籍一覧ビュー
│   │   ├── book-reader.tsx     # リーダー画面
│   │   └── chat-panel.tsx      # チャットパネル
│   └── api/                 # API Routes（外部APIプロキシ）
│       ├── books/
│       │   └── route.ts
│       ├── characters/
│       │   └── route.ts
│       └── chat/
│           └── route.ts
│
├── components/              # 汎用的・Atomicなコンポーネント
│   ├── ui/                  # 基本UIコンポーネント
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── dialog.tsx
│   └── common/              # 共通コンポーネント
│       └── header.tsx
│
├── lib/                    # ライブラリ・ユーティリティ
│   ├── api/               # APIクライアント
│   ├── mock-data/         # モックデータ定義
│   ├── utils/             # ユーティリティ関数
│   ├── constants/         # 定数
│   └── validators/        # バリデーション
│
├── hooks/                  # カスタムフック
│   ├── use-book.ts
│   ├── use-character.ts
│   ├── use-chat.ts
│   └── ...
│
├── services/              # サービス層（API Router経由）
│   ├── book-service.ts
│   ├── chat-service.ts
│   ├── character-service.ts
│   └── storage-service.ts
│
├── stores/                # 状態管理（Zustand）
│   ├── book-store.ts
│   ├── chat-store.ts
│   └── app-store.ts
│
├── types/                 # TypeScript型定義
│   ├── book.types.ts
│   ├── character.types.ts
│   ├── chat.types.ts
│   └── api.types.ts
│
└── styles/               # グローバルスタイル
    └── globals.css
```

### 2.2 コンポーネント設計

#### 基本原則
1. **単一責任の原則**: 1コンポーネント1責務
2. **コンポジション**: 小さなコンポーネントの組み合わせ
3. **Props Interface**: 明確な型定義
4. **Presentational/Container**: 表示と振る舞いの分離

#### コンポーネント例
```typescript
// components/features/BookReader/BookReader.tsx
interface BookReaderProps {
  bookId: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onCharacterClick?: (characterId: string) => void;
}

export const BookReader: FC<BookReaderProps> = ({
  bookId,
  initialPage = 1,
  onPageChange,
  onCharacterClick
}) => {
  // Implementation
};
```

### 2.3 状態管理戦略

#### 状態の分類
1. **Local State**: コンポーネント内部の状態
2. **Global State**: アプリ全体で共有する状態
3. **Server State**: サーバーから取得するデータ
4. **URL State**: URLパラメータで管理する状態

#### Zustand Store設計
```typescript
// stores/chatStore.ts
interface ChatStore {
  // State
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;

  // Actions
  setActiveConversation: (id: string) => void;
  sendMessage: (message: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  clearChat: () => void;
}
```

## 3. APIサーバー連携

### 3.1 外部APIエンドポイント

フロントエンドは以下のエンドポイントを外部APIサーバー（`http://localhost:8000`）から呼び出します：

#### API Routes（Next.js内）
```
GET    /api/books                 # 書籍一覧（外部APIへプロキシ）
GET    /api/books/:id             # 書籍詳細（外部APIへプロキシ）
GET    /api/characters            # キャラクター一覧（外部APIへプロキシ）
POST   /api/chat                  # チャットメッセージ送信（外部APIへプロキシ）
```

各API Routeは外部APIサーバー（http://localhost:8000）への
プロキシとして機能し、セキュリティ処理を一元化

### 3.2 フロントエンドデータ管理

#### ローカルストレージ構造
```typescript
// IndexedDB: 大容量データ
interface LocalBook {
  id: string;
  title: string;
  author: string;
  content: string;
  coverUrl?: string;
  lastRead?: Date;
}

// LocalStorage: 設定とセッション
interface UserPreferences {
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia';
  language: 'ja' | 'en';
}

// SessionStorage: 一時データ
interface ChatSession {
  sessionId: string;
  characterId: string;
  messages: Message[];
}
```

### 3.3 API連携実装

#### APIクライアント実装例
```typescript
// services/chat-service.ts
export class ChatService {
  async sendMessage(
    characterId: string,
    message: string,
    sessionId: string
  ): Promise<ChatResponse> {
    // API Routerを経由（セキュリティ層）
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId,
        message,
        sessionId
      })
    });
    return response.json();
  }
}

// app/api/chat/route.ts（API Router実装）
export async function POST(request: Request) {
  const body = await request.json();

  // 外部APIサーバーへのプロキシ
  const apiUrl = process.env.EXTERNAL_API_URL || 'http://localhost:8000';
  const externalResponse = await fetch(`${apiUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return Response.json(await externalResponse.json());
}
```

#### エラーハンドリング
```typescript
// lib/api/error-handler.ts
export async function handleApiError(error: unknown) {
  if (error instanceof TypeError) {
    // ネットワークエラー（APIサーバー未起動など）
    return {
      error: 'APIサーバーに接続できません。サーバーが起動していることを確認してください。',
      code: 'NETWORK_ERROR'
    };
  }
  // その他のエラー処理
  return { error: 'Unknown error', code: 'UNKNOWN' };
}
```

## 4. セキュリティ考慮事項

### 4.1 プロトタイプセキュリティ
- **実行環境**: ローカルホストのみ（外部公開しない）
- **認証**: 不要（プロトタイプのため）
- **セッション管理**: ブラウザセッションのみ

### 4.2 データ保護
- **通信**: HTTP（ローカルホスト間通信）
- **データ保存**: ブラウザローカルストレージ
- **CORS設定**: localhost間の通信を許可

### 4.3 コンテンツ保護
- **プロトタイプ**: サンプルコンテンツのみ使用
- **本番環境考慮**: 将来的なDRM実装を想定した設計

## 5. パフォーマンス最適化

### 5.1 フロントエンド最適化
- **コード分割**: Dynamic Import
- **画像最適化**: WebP, AVIF対応
- **キャッシュ戦略**: Service Worker
- **バンドルサイズ**: Tree Shaking, Minification

### 5.2 バックエンド最適化
- **データベース**: インデックス最適化、クエリ最適化
- **キャッシング**: Redis多層キャッシュ
- **非同期処理**: Queue による重い処理の非同期化

### 5.3 AI応答最適化
- **非同期処理**: Promise based API calls
- **キャッシュ**: 頻出質問の応答キャッシュ

## 6. 開発・展示環境

### 6.1 開発環境
- **ローカル開発**: localhost:3000（フロントエンド）
- **APIサーバー**: localhost:8000（別プロジェクト）
- **ブラウザ**: iPadのSafariで動作確認

### 6.2 展示環境
- **実行方法**: ローカルマシンで両サーバーを起動
- **アクセス**: iPadから同一ネットワーク内でアクセス
- **デバッグ**: ブラウザコンソールでログ確認

## 7. 開発環境

### 7.1 必要なツール
- Node.js 18+
- npm または yarn
- Git

### 7.2 環境構築
```bash
# 依存関係インストール
npm install  # または yarn install

# 環境変数設定
cp .env.example .env.local

# .env.local の設定
# EXTERNAL_API_URL=http://localhost:8000

# 開発サーバー起動
npm run dev  # または yarn dev

# 別ターミナルでAPIサーバーを起動
# http://localhost:8000 で起動
```

### 7.3 開発ツール
- **コード品質**: Biome（リント・フォーマット統合）
- **型チェック**: TypeScript strict mode
- **パッケージマネージャ**: npm / yarn