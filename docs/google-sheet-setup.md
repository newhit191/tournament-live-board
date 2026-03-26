# Google Sheet 串接步驟

這份文件是給目前的 `Tournament Live Board` 專案使用，目標是把資料來源從 mock data 切換成真正的 Google Sheet。

## 第 1 步：建立空白 Google Sheet

1. 用你的 Google 帳號建立一份新的 Spreadsheet
2. 幫它取一個容易辨識的名稱，例如：
   `Tournament Live Board Demo`
3. 把網址中的 Spreadsheet ID 留下來

範例：

```text
https://docs.google.com/spreadsheets/d/這一段就是SpreadsheetID/edit
```

## 第 2 步：建立 Google service account

1. 到 Google Cloud Console 建立專案
2. 啟用 `Google Sheets API`
3. 建立 `Service Account`
4. 產生 JSON 金鑰
5. 從 JSON 中取出：
   - `client_email`
   - `private_key`

## 第 3 步：把 Spreadsheet 分享給 service account

把剛剛 JSON 裡的 `client_email` 加到這份 Spreadsheet 的共用名單中，權限至少要是「編輯者」。

## 第 4 步：建立 `.env.local`

請在專案根目錄建立 `.env.local`，內容可參考：

```env
ADMIN_PASSWORD=你自己的後台密碼
GOOGLE_SHEETS_SPREADSHEET_ID=你的SpreadsheetID
GOOGLE_SHEETS_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

注意：

- `private_key` 內的換行要保留為 `\n`
- 外層建議加雙引號

## 第 5 步：初始化 Sheet 結構

在專案目錄執行：

```bash
npm run setup:sheets
```

這個指令會自動：

- 建立需要的分頁
- 寫入每張表的表頭
- 凍結第一列

建立的分頁如下：

- `tournaments`
- `players`
- `matches`
- `match_sets`
- `standings`
- `event_log`

## 第 6 步：重新啟動網站

完成後重新啟動開發伺服器：

```bash
npm run dev
```

如果 `.env.local` 設定正確，網站之後就會優先讀取 Google Sheet，而不是 mock data。

## 目前已完成與未完成

目前已完成：

- Google Sheet 讀取
- 自動初始化表頭與分頁
- mock data fallback

下一步會做：

- 建立賽事寫入 `tournaments`
- 建立玩家寫入 `players`
- 產生單淘汰 / 循環賽賽程寫入 `matches`
- 更新分局與比分寫入 `match_sets`
- 指定展示中的焦點場次
