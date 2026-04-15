# RECORE 棚卸しスキャナー — セットアップガイド

## 環境要件

- Docker Desktop（Windows）
- Docker Compose

## セットアップ手順

### 1. Docker Desktop をインストール
https://docker.com/get-started/ から Docker Desktop をダウンロードしてインストールしてください。

### 2. コマンドプロンプトまたはPowerShellを起動

Windows Key + R → `cmd` または `powershell` と入力して実行

### 3. プロジェクトディレクトリに移動

```bash
cd C:\Users\ueda\scanner
```

### 4. Docker コンテナをビルド・起動

```bash
docker-compose up --build
```

初回は依存パッケージのインストールに数分かかります。

### 5. ブラウザでアクセス

起動完了後、以下のURLにアクセス：

```
http://localhost:5173
```

## トラブルシューティング

### ポート 5173 は既に使用中の場合

`docker-compose.yml` を編集して別のポートに変更：

```yaml
ports:
  - "8000:5173"  # localhost:8000 でアクセス
```

### コンテナを停止する

```bash
docker-compose down
```

### ログを確認する

```bash
docker-compose logs -f app
```

## 開発時の注意

- ファイルを編集すると自動的に再コンパイルされます
- ホットリロードが有効です
- Node.js / npm はコンテナ内で実行されます
