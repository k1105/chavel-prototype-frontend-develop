# AI コーディングガイドライン

## プロジェクト概要
このプロジェクトは、iPad向けのインタラクティブ電子書籍アプリケーション「Chavel」のフロントエンド実装です。シングルページアプリケーションとして、書籍一覧とリーダー/チャット画面の2つのビューを提供します。

## 技術的な制約と前提条件

### 必須要件
- **プラットフォーム**: iPadでの動作を最優先
- **レスポンシブ**: 768px以上のタブレット解像度に最適化
- **タッチ操作**: すべてのインタラクションはタッチジェスチャーに対応
- **パフォーマンス**: 60fps以上のスムーズなアニメーション

### 技術スタック
- **Next.js 14**: App Routerを使用
- **TypeScript**: 厳格な型チェック（strict: true）
- **Tailwind CSS**: ユーティリティファーストのスタイリング
- **React 18**: Server Componentsを活用
- **Biome**: リント・フォーマット統合ツール

## コーディング規約

### TypeScript
- すべてのコンポーネントと関数に適切な型定義を追加
- `any`型の使用は原則禁止
- インターフェースは`I`プレフィックスを使用しない
- 型定義は`types/`ディレクトリに集約

### React コンポーネント
- 関数コンポーネントのみを使用
- カスタムフックは`use`プレフィックスで開始
- **ファイル名はケバブケース**: `book-reader.tsx`、`chat-panel.tsx`
- 1ファイル1コンポーネントを原則とする

### ディレクトリ構造
```
app/
  ├── page.tsx         # シングルページアプリ
  ├── layout.tsx       # ルートレイアウト
  ├── _components/     # ページコンポーネント
  │   ├── book-list.tsx     # 書籍一覧
  │   ├── book-reader.tsx   # リーダー画面
  │   └── chat-panel.tsx    # チャットパネル
  └── api/            # API Routes（外部APIプロキシ）
      ├── books/
      ├── characters/
      └── chat/

components/         # 汎用的・Atomicなコンポーネント
  ├── ui/           # 基本UIコンポーネント
  │   ├── button.tsx
  │   ├── card.tsx
  │   └── input.tsx
  └── common/       # 共通コンポーネント

lib/
  ├── utils/        # ユーティリティ関数
  ├── constants/    # 定数定義
  └── mock-data/    # モックデータ
      ├── books.ts  # 書籍のモックデータ
      ├── characters.ts # キャラクターのモックデータ
      └── chat.ts   # チャット応答のモックデータ

hooks/              # カスタムフック（use-*.ts）
services/           # APIクライアント（API Router経由）
types/              # 型定義
```

## AI実装のガイドライン

### システム構成
- AI対話処理は別プロジェクトのAPIサーバーで実行
- フロントエンドはNext.js API Router経由で通信
- 非同期通信のみ（WebSocket不使用）

### APIインテグレーション
```typescript
// services/chat-service.ts の例
interface CharacterResponse {
  message: string;
  emotion?: string;
  metadata?: Record<string, any>;
}

// クライアント → Next.js API Router → 外部APIサーバー
async function chatWithCharacter(
  characterId: string,
  message: string,
  context?: ChatContext
): Promise<CharacterResponse> {
  // API Routerを経由（セキュリティ層）
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, message, context })
  });
  return response.json();
}

// app/api/chat/route.ts の例
export async function POST(request: Request) {
  const body = await request.json();

  // 外部APIサーバーへプロキシ
  const externalResponse = await fetch(`${process.env.EXTERNAL_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return Response.json(await externalResponse.json());
}
```

## 状態管理
- グローバル状態: Zustand を使用
- ローカル状態: useState, useReducer
- サーバー状態: TanStack Query

## パフォーマンス最適化
- 画像: next/image で最適化
- フォント: next/font で最適化
- コード分割: dynamic importを活用
- メモ化: useMemo, useCallbackを適切に使用

## コード品質管理

### Biome設定
Biomeを使用してリントとフォーマットを統一管理：

```json
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

### 開発コマンド
- `npm run lint` または `yarn lint` - Biomeでリント実行
- `npm run format` または `yarn format` - Biomeでフォーマット実行
- `npm run type-check` または `yarn type-check` - TypeScript型チェック

## 開発フロー

### ブランチ戦略
- main: プロダクション
- develop: 開発ブランチ
- feature/*: 機能開発
- fix/*: バグ修正

### コミットメッセージ
```
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
style: フォーマット修正
refactor: リファクタリング
test: テスト追加・修正
chore: ビルド・補助ツール
```

## セキュリティ
- APIエンドポイントURLは環境変数で管理
- クライアントサイドに機密情報を露出しない
- XSS対策の徹底
- CORS設定の適切な管理

## アクセシビリティ
- ARIA属性の適切な使用
- キーボードナビゲーション対応
- スクリーンリーダー対応
- カラーコントラスト基準の遵守

## 重要な注意事項
1. iPadのSafariでの動作を必ず確認
2. タッチイベントの最適化を優先
3. ローカルホストでの展示を前提とした実装
4. 外部APIサーバーとの連携が必須