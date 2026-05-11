# create-pages-site-template

[English](./README.md) · **简体中文**

一个用来搭建**个人"实验室"（lab）**的模板：在一个 Cloudflare Workers 子域名下，平铺式地托管 HTML 页面、静态 React 应用、和全栈 React + D1 应用。

一个仓库、一个 Cloudflare 账号、一个子域名。加一个新页面或新应用只需写一个文件或一个文件夹 —— 不用碰任何基础设施。便宜地新增、便宜地删除、应用长大了也能便宜地"毕业"出去独立部署。

---

## 一个 lab 里能放些什么

| 类型 | 放在哪 | URL | 由谁托管 |
|---|---|---|---|
| HTML 页面 | `pages/<slug>.html` | `/<slug>.html` 或 `/pages/<slug>.html` | root Worker |
| 静态 React 应用 | `apps/<slug>/` | `/apps/<slug>/` | root Worker |
| 全栈应用（登录 + 数据库） | `apps/<slug>/` 且 `lab.fullstack: true` | `/apps/<slug>/*` | 自己的 Worker、自己的 D1、自己的 Better Auth 域 |

所有 URL 都在同一个主机名下。`/apps/<slug>/*` 的分发对应用来说是透明的：自定义域名走 Cloudflare Workers Routes，workers.dev 走 Service Bindings。

每个全栈应用的技术栈：Vite + React 19、Workers 上跑 Hono、D1 上跑 Drizzle、Better Auth（用了自定义的 PBKDF2 哈希，能放进免费版 10ms CPU 限制里）、Tailwind v4 + 消费 `DESIGN.md` 品牌 token 的 shadcn 基础组件。

---

## 创建一个新 lab

新机器一次性配置：

```bash
git clone git@github.com:z333d/create-pages-site-template.git
cd create-pages-site-template
pnpm install
npx wrangler login                       # 交互式浏览器登录
node scripts/setup.mjs                   # 写 ~/.config/create-pages-site/config.json
```

然后创建你的 lab（端到端 ~2 分钟）：

```bash
node scripts/create-lab.mjs <lab-name>   # 一条命令搞定：
#   • 把模板拷到 <projects-dir>/<lab-name>/
#   • 建 GitHub 仓库 + 首次 commit + push
#   • 为每个全栈 app 建 D1 + 跑迁移
#   • 部署所有 Worker + 设置 BETTER_AUTH_SECRET / BETTER_AUTH_URL
#   • 打印线上 URL
```

可选 flag：`--no-deploy`（不动 Cloudflare）、`--no-domain`（用 *.workers.dev）、`--domain my.example.com`、`--keep-on-fail`（出错不回滚便于排查）、`--org <github-owner>`。

---

## 日常使用

lab 在 `<projects-dir>/<lab-name>/`，已经有真实部署。增加内容是本地改 + `git push`（或 `pnpm deploy:*`）。

**加 HTML 页面** — ~30 秒

```bash
pnpm scaffold page <slug>
# 编辑 pages/<slug>.html —— 单文件、内联 <style> 和 <script>，无构建步骤
pnpm deploy:root
# 上线在 /pages/<slug>.html（也支持 /<slug>.html）
```

**加静态 React 应用** — ~2 分钟

```bash
pnpm scaffold app <slug>
# 在 apps/<slug>/ 写中性 DESIGN.md + App.tsx 占位
# 写 UI 前，先从 design-patterns.md 选一个 register，重写 DESIGN.md，
# 跑 `pnpm theme:gen`，然后改 src/App.tsx
pnpm build && pnpm deploy:root
# 上线在 /apps/<slug>/
```

**加全栈应用** — ~10 分钟（唯一一条需要手动跑 Cloudflare 步骤的路径）

```bash
pnpm scaffold app <slug> --fullstack

# 1. 创建 D1
npx wrangler d1 create <lab-name>-<slug>
# 把返回的 database_id 粘进 apps/<slug>/wrangler.jsonc

# 2. 应用 auth-only 的初始迁移
cd apps/<slug>
npx wrangler d1 execute <lab-name>-<slug> --remote --file drizzle/migrations/0000_init.sql

# 3. 设两个 secrets
echo -n "$(openssl rand -base64 36)" | npx wrangler secret put BETTER_AUTH_SECRET
echo -n "https://<lab-name>.<your-domain>" | npx wrangler secret put BETTER_AUTH_URL

# 4. 部署
cd ../..
pnpm build && pnpm deploy:all
# 上线在 /apps/<slug>/
```

**本地开发**

```bash
pnpm dev                          # 全部：root Worker + 每个全栈 app
pnpm --filter @lab/<slug> dev     # 只跑一个 app
```

**重新部署**

```bash
pnpm deploy:root                  # 只重部 root Worker（页面 + 静态 app + landing）
pnpm deploy:all                   # 全量（root + 每个全栈 Worker）
```

`design-patterns.md` 是 agent 和你共享的审美词汇表 —— 给新应用写 UI 前先翻一下，避免落入 AI 默认的"SaaS 极简"那种平庸。

---

## 文档

- **[AGENTS.md](./AGENTS.md)** — 给任何在生成的 lab 里干活的 AI agent（或人）看的操作手册：约定、品牌流程、已知陷阱、故障排除。同时被 symlink 成 `CLAUDE.md` 供 Claude Code 自动加载。
- **[HANDOFF.md](./HANDOFF.md)** — 给"继续维护这个模板仓库本身"的人看的交接文档：当前进度、未完成事项、已知陷阱、状态存放在哪里。
- **[GRADUATION.md](./GRADUATION.md)** — 当某个 lab 应用长大到需要独立成仓库时怎么搬出去。
- **[design-patterns.md](./design-patterns.md)** — 一份共享的审美词汇表（7 个命名的风格 register，从 Essay 到 Manifesto），agent 和用户在为新应用挑风格时有共同的指向语言。

---

## 内置示范

- **`apps/todo/`** — 全栈应用，Notebook register（暖米色、衬线、安静的个人工具）
- **`apps/counter/`** — 静态应用，Terminal register（等宽字体、深色、紧凑）
- **`pages/welcome.html`** — 示范 HTML 页面

这是 agent 和你拿不准时可以直接看的工作样本。

---

## 为什么是模板而不是生成器

模板就是一个可以 clone 的文件夹，所有东西都看得见、改得动，没有"先生成、再 eject"的悬崖。Claude Code 的 `create-pages-site` skill 把 `create-lab.mjs` 流程包成对话式接口，但模板本身独立可用 —— 任何有 Cloudflare 账号 + GitHub 账号的人（或 agent）都可以直接跑这些脚本。
