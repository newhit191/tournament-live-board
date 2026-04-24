# Supabase 建置手把手（v1）

這份文件是給你操作用，照順序做就好。  
目標：先完成「可註冊 / 可登入 / 可建玩家 / 有星星錢包」基礎環境。

## 0. 前置
- 你有 Supabase 帳號（免費版即可）
- 本機專案路徑：`C:\Users\newhi\Documents\tournament-live-board`

## 1. 建立 Supabase 專案
1. 進入 Supabase Dashboard。
2. `New project`。
3. Project name 建議：`tournament-live-board`。
4. Database 密碼自己設定並保存。
5. Region 建議選離你近的區域（例如 Singapore）。

## 2. 取得 API 金鑰
1. 進入 `Project Settings > API`。
2. 複製以下值：
   - `Project URL`
   - `anon public key`
   - `service_role key`（只給後端使用，不可放前端）

## 3. 設定本機環境變數
1. 專案根目錄建立（或更新）`.env.local`
2. 加入：

```env
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon key
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

## 4. 建立資料表與 RLS
1. 到 `SQL Editor`。
2. 開新 Query。
3. 把檔案 `scripts/supabase/001_init_core.sql` 內容整份貼上。
4. 按 `Run`。

如果成功，應該會出現這些主要表：
- `accounts`
- `players`
- `player_wallets`
- `wallet_ledger`
- `invite_codes`

## 5. 開啟 Auth（Email / Password）
1. 進入 `Authentication > Providers`。
2. 確認 `Email` Provider 已啟用。
3. 是否啟用信箱驗證（Confirm email）先用這個策略：
   - 內測期：可先關閉（開發更快）
   - 正式給朋友用：建議開啟

## 6. 建立第一組邀請碼（SQL）
到 SQL Editor 執行：

```sql
insert into public.invite_codes (code, max_uses, note)
values ('BLADE-FRIEND-001', 20, '第一批朋友內測');
```

## 7. 驗證結果
在 Table Editor 應可看到：
- `invite_codes` 有剛建立的 code
- `accounts` 會在新使用者註冊後自動產生
- `players` 新增後會自動建立對應 `player_wallets`

## 8. 下一步（我會幫你做）
- 專案接上 Supabase SDK
- 註冊頁加入邀請碼檢查與核銷
- 登入後建立/管理多玩家
- 星星帳本與 GM 補星流程

## 9. 設定第一位 GM（必要）
新註冊完成後，先用 SQL 把你的帳號角色改成 GM：

```sql
update public.accounts
set role = 'gm'
where id = (
  select id
  from auth.users
  where email = '你的登入信箱'
);
```

設定後即可使用 `/gm` 頁面執行補星。

---

## 常見錯誤
- `permission denied for schema auth`：代表 SQL 權限不足，請確認用專案 owner 執行。
- `function already exists`：可忽略（腳本已用 `replace`/`if not exists` 盡量處理）。
- key 放錯：`service_role` 只能後端使用，前端只能用 `anon key`。
