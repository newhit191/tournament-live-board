# Tournament Live Board

使用 Next.js、Tailwind CSS 與 Google Sheets API 製作的賽事專業網站。

這個專案的定位是：
- 主辦方後台 + 公開展示頁
- 1 對 1 個人賽
- 適合 1 到 2 人操作
- 支援大螢幕展示與即時比分更新

## 目前功能

- 建立賽事
- 設定參賽人數並逐格輸入選手名稱
- 支援單淘汰賽與循環賽
- 支援目標分制與分局加總制
- 可指定目前展示中的場次
- 可更新比分、直接覆蓋最終比分
- 公開頁可查看賽程、目前進行中的場次與歷史賽事
- 比賽資料可寫入固定 Google Sheet

## 技術棧

- Next.js App Router
- Tailwind CSS v4
- Google Sheets API

## 本機啟動

1. 安裝依賴

```bash
npm install
```

2. 建立環境變數

```bash
cp .env.example .env.local
```

3. 啟動開發環境

```bash
npm run dev
```

4. 開啟 [http://localhost:3000](http://localhost:3000)

## 環境變數

- `ADMIN_PASSWORD`
  後台登入密碼
- `GOOGLE_SHEETS_SPREADSHEET_ID`
  Google Sheet 的 Spreadsheet ID
- `GOOGLE_SHEETS_CLIENT_EMAIL`
  service account email
- `GOOGLE_SHEETS_PRIVATE_KEY`
  service account private key，保留 `\n`
- `NEXT_PUBLIC_SITE_URL`
  網站公開網址

如果沒有先接 Google Sheets，系統會自動使用內建 mock data 來展示畫面。

## Google Sheet 分頁

- `tournaments`
- `players`
- `matches`
- `match_sets`
- `standings`
- `event_log`

## 常用指令

```bash
npm run setup:sheets
```

初始化 Google Sheet 欄位結構。

```bash
npm run seed:demo
```

把示範資料重新寫入 Google Sheet。

## 備註

- `tournaments` 會保留舊欄位 `win_score_rule` 以維持相容性。
- 新模型主要使用 `scoring_mode`、`target_score`、`set_count`。
- 如果你先前曾把 service account 私鑰貼到公開對話或其他不安全位置，建議到 Google Cloud 重新輪替一把新的 key。
