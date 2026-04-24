# Tournament Live Board

戰鬥陀螺社群賽事與約戰平台（Next.js 16 + Supabase）。

目前專案同時保留：
- 舊版：Google Sheets 賽事看板（原本系統）
- 新版：Supabase 帳號/玩家/星星系統（改版中）

## 新版已完成
- Email + 密碼登入
- 邀請碼註冊
- 一帳號多玩家（家長/小孩）
- 玩家錢包（可用星星 / 鎖定星星）
- 不可逆帳本 `wallet_ledger`
- 家庭內星星互轉（RPC）
- GM 補星（RPC + 後台頁面）
- 約戰看板（單場對賭 / 多人獎池）
- 約戰流程（建立、加入、取消、完賽結算）
- 排行榜（總榜 / 跨家庭榜）
- 稱號系統（基礎稱號 + 動態稱號 + 玩家佩戴）

## 快速啟動
1. 安裝依賴

```bash
npm install
```

2. 建立 `.env.local`（可參考 `.env.example`）

必要 Supabase 變數：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

3. 啟動開發伺服器

```bash
npm run dev
```

4. 開啟：
- 首頁：`http://localhost:3000`
- 註冊登入：`http://localhost:3000/auth`
- 玩家中心：`http://localhost:3000/hub`
- 約戰看板：`http://localhost:3000/arena`
- 排行榜：`http://localhost:3000/rankings`
- GM 補星：`http://localhost:3000/gm`

## Supabase 初始化
已提供 migration：
- `20260422100321_init_core.sql`
- `20260422100912_seed_default_invite_code.sql`
- `20260422103000_wallet_operations.sql`
- `20260422105000_bootstrap_first_admin.sql`
- `20260423001000_phase2_challenges_rankings.sql`

如需手動檢視，可見：
- `scripts/supabase/001_init_core.sql`
- `docs/supabase-setup-v1.md`

## 重要提醒
- `SUPABASE_SERVICE_ROLE_KEY` 只能放伺服器端，不能暴露前端。
- 星星帳本採不可逆設計，不直接改餘額，改用補正交易。
- 目前仍在內測階段，先不要直接部署到正式公開環境。
