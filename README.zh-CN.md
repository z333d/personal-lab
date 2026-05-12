# personal-lab

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

## 前置依赖

开始之前需要的东西（这些是所有 lab 共用的基础，不只是这个模板）：

- 一个 **GitHub 账号**（免费层即可）
- 一个 **Cloudflare 账号**（免费层即可 —— 100 个 Worker + 10 个 D1 数据库的限额对个人 lab 完全够用）
- *可选：* 一个由 Cloudflare DNS 托管的域名 —— 如果你想用 `<lab>.<你的域名>` 而不是 `<lab>.<account>.workers.dev`

CLI 工具（macOS 命令；Linux/Windows 等价替换）：

| 工具 | 安装 | 登录 |
|---|---|---|
| Node 20+ | `brew install node`（或用 `nvm` / `fnm`） | — |
| pnpm 10+ | `corepack enable pnpm`（Node 22+ 自带 corepack） | — |
| gh CLI | `brew install gh` | `gh auth login`（选 SSH） |
| wrangler | 内置 —— 下一步 `pnpm install` 时会装 | `npx wrangler login`（浏览器交互登录） |

*可选但推荐：* 给 gh 授予 `delete_repo` scope，后面想删测试 lab 用 CLI 就方便 —— 默认 `gh auth login` 不包含这个权限。

```bash
gh auth refresh -h github.com -s delete_repo
```

继续之前自检一下：

```bash
node --version       # v20 或更高
pnpm --version       # 10 或更高
gh auth status       # "Logged in to github.com account <你>"
npx wrangler whoami  # "You are logged in with … associated with the email …"
```

---

## 配置（每个用户一次）

Clone 模板并跑一次 setup 向导。模板可以一直留在硬盘上 —— 你只需要 clone 一次，从它创建出来的每个 lab 都在自己独立的目录里。

```bash
git clone git@github.com:z333d/personal-lab.git
cd personal-lab
pnpm install
node scripts/setup.mjs       # 写 ~/.config/personal-lab/config.json
```

`setup.mjs` 问你三件事，每件都有合理的默认值：

1. **GitHub 账号 / org** —— 新 lab repo 创建在哪个账号下（默认你的 `gh` 登录账号）
2. **URL 模式** —— 用 `<lab>.<你的域名>`（需要一个由 Cloudflare 托管的 zone）或 `<lab>.<account>.workers.dev`
3. **新 lab 放在硬盘哪个目录** —— 例如 `~/projects/playground`

---

## 创建一个 lab

```bash
node scripts/create-lab.mjs <lab-name>   # 端到端 ~2 分钟
```

一条命令搞定：

- 把模板拷到 `<projects-dir>/<lab-name>/`
- 建 GitHub 仓库 + 首次 commit + push
- 为每个全栈 app 建 D1 + 跑迁移
- 部署所有 Worker + 设置 `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`
- 打印线上 URL

可选 flag：`--no-deploy`（不动 Cloudflare）、`--no-domain`（强制用 *.workers.dev）、`--domain my.example.com`（覆盖配置的 zone）、`--keep-on-fail`（出错不回滚，便于排查）、`--org <github-owner>`（覆盖配置的 GitHub 账号）。

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

**加全栈应用** — 一条命令端到端，用 `--deploy`

```bash
pnpm scaffold app <slug> --fullstack --deploy
# scaffold + 建 D1 + 迁移 + secrets + .dev.vars + build + 部署
# 命令返回时已经上线在 /apps/<slug>/。重跑安全（幂等）。
```

如果想分步做（为了观察中间状态，或者不希望 scaffold 替你动 Cloudflare 资源）：

```bash
pnpm scaffold app <slug> --fullstack       # 不加 --deploy

# 1. 创建 D1
npx wrangler d1 create <lab-name>-<slug>
# 把返回的 database_id 粘进 apps/<slug>/wrangler.jsonc

# 2. 应用 auth-only 初始迁移
cd apps/<slug>
pnpm db:migrate:remote

# 3. 设两个生产环境 secrets
echo -n "$(openssl rand -base64 36)" | npx wrangler secret put BETTER_AUTH_SECRET
echo -n "https://<lab-name>.<your-domain>" | npx wrangler secret put BETTER_AUTH_URL

# 4. （可选）配 .dev.vars 让 `pnpm dev` 本地也能跑 auth
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars：填一个随机的 BETTER_AUTH_SECRET（本地用，随便一个值）
# BETTER_AUTH_URL=http://localhost:8787 wrangler dev 默认就这个端口

# 5. 部署
cd ../..
pnpm build && pnpm deploy:all
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

**删除一个 page 或 app**

```bash
pnpm scaffold rm <slug>           # 自动识别类型，destructive 操作前会确认
pnpm scaffold rm <slug> --yes     # 跳过确认
```

会删除本地文件、Cloudflare Worker + D1（全栈），并自动 rebuild + 重部 root Worker 让 service binding / 资源同步消失。D1 删除不可恢复 —— 数据重要的话先备份。

**加 R2 bucket**（放不该进 git 的大图、字体、视频）

```bash
pnpm scaffold r2 <bucket>
# 建 Cloudflare R2 bucket `<lab>-<bucket>`，打印 binding 配置片段
# 让你贴到需要它的 app 的 wrangler.jsonc 里
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
