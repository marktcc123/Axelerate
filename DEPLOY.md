# 发布上线操作说明（Vercel + Supabase）

本地已验证：`npm run build` 可通过。

## 一、准备代码仓库

1. 若尚未使用 Git，在项目根目录初始化并提交：

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. 在 GitHub（或 GitLab）新建空仓库，按页面提示添加 `remote` 并 `git push`。

> `.env.local` 已在 `.gitignore` 中，不会被提交；密钥只在托管平台配置。

## 二、在 Vercel 部署

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录。
2. **Add New… → Project**，选择本仓库，Import。
3. Framework Preset 选 **Next.js**，Build Command 默认 `next build`，Output 由平台自动处理。
4. 在 **Environment Variables** 中新增下列变量（值与本地 `.env.local` 一致；名称必须一致）：

   | 变量名 | 说明 |
   |--------|------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名公钥（或改用下一项） |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 若你本地用的是 publishable key，填此项（与 anon 二选一即可，见 `lib/supabase/client.ts`） |
   | `SUPABASE_SERVICE_ROLE_KEY` | **服务端密钥**，勿暴露给前端；仅填在 Vercel，勿提交到 Git |

   可选（若本地有配置可一并加上）：

   - `NEXT_PUBLIC_SITE_URL` — 生产站点完整 URL，例如 `https://你的域名.vercel.app`（**Stripe 成功回跳依赖正确站点地址**）
   - `NEXT_PUBLIC_ADMIN_PASSWORD` — 管理入口密码；若不设，代码内有默认值（生产环境建议务必设置强密码）

   **Perks Shop 银行卡支付（Stripe，可选）**

   | 变量名 | 说明 |
   |--------|------|
   | `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key |
   | `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → 添加 endpoint 后给出的 **Signing secret** |

   Webhook URL 填：`https://你的线上域名/api/webhooks/stripe`，事件至少勾选 **`checkout.session.completed`**。  
   本地调试可用 Stripe CLI：`stripe listen --forward-to localhost:3000/api/webhooks/stripe`。

   数据库需执行迁移：

   - `supabase/migrations/00024_orders_stripe_checkout_session.sql` — 商城 Stripe 订单幂等字段  
   - `supabase/migrations/00027_wallet_stripe_topup.sql` — 钱包充值流水类型 `wallet_deposit` + 表 `stripe_wallet_topups`

5. 点击 **Deploy**。完成后会得到 `https://xxx.vercel.app`。

6. 若需自定义域名：Project → **Settings → Domains** 按提示添加 DNS。

## 三、Supabase 控制台（登录必改）

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **Authentication → URL Configuration**。
2. **Site URL** 改为生产地址，例如：`https://xxx.vercel.app`。
3. **Redirect URLs** 中增加（每行一条，保留本地开发用的也可）：

   - `https://xxx.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`（本地调试可保留）

4. 若使用 **Google 等 OAuth**，在对应云控制台里允许的回调地址仍以 Supabase 提供的为准；应用内 `redirectTo` 使用 `window.location.origin`，上线后会自动指向你的生产域名。

## 四、后续更新

在本地改代码后：

```bash
git add .
git commit -m "描述改动"
git push
```

Vercel 会自动重新构建并发布。环境变量变更后需在 Vercel 里保存并 **Redeploy** 一次。

## 五、其他托管方式（简要）

- **自建 VPS**：`npm ci && npm run build && npm run start`，前面用 Nginx/Caddy 做 HTTPS 反向代理；同样需在服务器上配置上述环境变量。
- **Netlify / Cloudflare Pages**：流程类似，配置构建命令 `npm run build` 与 Next 适配说明，并填入相同环境变量。

---

有问题时先看 Vercel 部署日志里的 **Build** 与 **Functions** 报错，并确认 Supabase 的 Site URL / Redirect URLs 与线上域名完全一致。
