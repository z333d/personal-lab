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

```bash
git clone git@github.com:z333d/create-pages-site-template.git
cd create-pages-site-template
pnpm install
npx wrangler login                       # 交互式登录
node scripts/setup.mjs                   # 一次性配置（每个用户跑一次）

node scripts/create-lab.mjs <lab-name>   # 一条命令搞定全部：
#   • 把模板拷到 ../<lab-name>/
#   • 建 GitHub 仓库 + 首次 commit + push
#   • 为每个全栈 app 建 D1 + 跑迁移
#   • 部署所有 Worker + 设置 BETTER_AUTH_SECRET / BETTER_AUTH_URL
#   • 打印线上 URL
```

可选 flag：`--no-deploy`（不动 Cloudflare）、`--no-domain`（用 *.workers.dev）、`--domain my.example.com`、`--keep-on-fail`（出错不回滚，便于排查）、`--org <github-owner>`。

进入生成的 lab 后，用 `pnpm scaffold page|app <slug> [--fullstack]` 加内容。改完跑 `pnpm build && pnpm deploy:all` 重新部署。

---

## 文档

- **[AGENTS.md](./AGENTS.md)** — 给任何在生成的 lab 里干活的 AI agent（或人）看的操作手册：约定、品牌流程、已知陷阱、故障排除。同时被 symlink 成 `CLAUDE.md` 供 Claude Code 自动加载。
- **[HANDOFF.md](./HANDOFF.md)** — 给"继续维护这个模板仓库本身"的人看的交接文档：当前进度、未完成事项、已知陷阱、状态存放在哪里。
- **[GRADUATION.md](./GRADUATION.md)** — 当某个 lab 应用长大到需要独立成仓库时怎么搬出去。
- **[`design-samples/`](./design-samples/)** — 三个参考 DESIGN.md 变体（Notebook、Terminal、Postcard），给 agent + 用户在选品牌时一些具体的方向。

---

## 内置示范

`apps/` 下的两个应用是"可能的样子"的示范，**不是**官方风格：

- **`apps/todo/`** — Notebook 主题、全栈（Hono + D1 + Better Auth）
- **`apps/counter/`** — Terminal 主题、静态

兄弟应用的品牌**不应被默认继承** —— 每个新应用通过自己的 `DESIGN.md` 设定自己的调性。自动生成的 lab 首页刻意保持中性（系统字体、无彩度），因为 lab 本身只是个目录页，不是品牌。

---

## 为什么是模板而不是生成器

模板就是一个可以 clone 的文件夹，所有东西都看得见、改得动，没有"先生成、再 eject"的悬崖。Claude Code 的 `create-pages-site` skill 把 `create-lab.mjs` 流程包成对话式接口，但模板本身独立可用 —— 任何有 Cloudflare 账号 + GitHub 账号的人（或 agent）都可以直接跑这些脚本。
