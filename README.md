# 智域手机版 · 邀请码内测

智域手机版的可部署源码，包含手机界面、邀请码进入、七位智友、聊天与群聊、动态圈、任务、Molly 报告，以及内测后台和问卷。

手机入口：`/mobile`。后台入口：`/admin`。部署后，将你的 **HTTPS 域名 + `/mobile`** 和每人独立的邀请码发给内测用户，用户即可在手机浏览器进入。

本仓库包含 Node 服务和前端源码。实际供别人使用的网页地址由部署服务器提供；仓库中不附带正式邀请码、管理员密码、模型密钥或任何现有账号的聊天数据。

## 本地运行

源码要求 Node.js ≥22.13；仓库内 Dockerfile 使用 Node.js 24。以下命令适用于 macOS / Linux，在仓库根目录执行：

```sh
npm ci
npm run build
mkdir -p ../zhiyu-private
cp .env.example ../zhiyu-private/zhiyu.env
chmod 600 ../zhiyu-private/zhiyu.env
```

用编辑器在 `../zhiyu-private/zhiyu.env` 填入自己的模型服务凭证。首次使用时，设置创始人后台密码：

```sh
ZHIYU_ENV_FILE=../zhiyu-private/zhiyu.env npm run beta:admin
```

选择 `founder`，按终端提示输入密码；若需要投资人只读后台，再执行一次并选择 `investor`。随后启动：

```sh
ZHIYU_ENV_FILE=../zhiyu-private/zhiyu.env npm start
```

打开 [本地后台](http://127.0.0.1:3100/admin)，以创始人身份生成邀请码；打开 [本地手机界面](http://127.0.0.1:3100/mobile)，勾选成年确认并输入邀请码进入。同一个邀请码用于恢复同一个账号，请按人分发。

## 部署到阿里云 / Linux 服务器

可以让阿里云 ECS 从本仓库拉取代码，然后使用 `distribution/beta/Dockerfile` 构建运行。准备域名和 HTTPS 反向代理，配置 `ZHIYU_PUBLIC_ORIGIN`、模型凭证，并持久保存 `.npc-runtime`。

```sh
docker build -f distribution/beta/Dockerfile -t zhiyu-beta:latest .
docker volume create zhiyu-beta-runtime
docker run -d --name zhiyu-beta --restart unless-stopped \
  -e ZHIYU_PUBLIC_ORIGIN=https://zhiyu.example.com \
  -e ZHIYU_ENV_FILE=/run/secrets/zhiyu.env \
  --mount type=bind,src=/etc/zhiyu/zhiyu.env,dst=/run/secrets/zhiyu.env,readonly \
  --mount source=zhiyu-beta-runtime,target=/app/.npc-runtime \
  -p 127.0.0.1:3100:3100 \
  zhiyu-beta:latest
```

将示例域名和密钥文件路径替换为自己的配置。容器环境文件中使用 `HOST=0.0.0.0`，并保证容器用户可读取密钥文件。Nginx 模板在 `distribution/beta/nginx.conf`。管理员初始化命令：

```sh
docker exec -it zhiyu-beta npm run beta:admin
```

完整步骤、邀请码分发、备份恢复与验收范围见 [内测部署与验收](docs/内测部署与验收.md)。[阿里云 Git 仓库构建部署说明](https://help.aliyun.com/zh/ecs/user-guide/deploy-applications)。

## 数据与运行能力

- 当前使用 SQLite 和本地媒体文件，按单应用进程、单副本部署；升级时保留同一 `.npc-runtime` 数据卷。
- 七位智友的现行规则、知识与必要素材随源码提供；发布副本使用通用初始资料和空动态，不携带开发机账号内容。
- 聊天需要配置对应模型凭证。语音、生图、天气等沿各自提供方配置；基础 Docker 镜像不包含本地模型权重或 GPU 运行环境。
- 手机界面可通过浏览器使用；电脑上的 iPhone 样式预览及原生设备能力另有运行环境要求。

## 主要命令

| 命令 | 用途 |
| --- | --- |
| `npm run build` / `npm run beta:build` | 构建 Node 内测生产版 |
| `npm start` / `npm run beta:start` | 启动生产服务 |
| `npm run beta:admin` | 交互设置后台密码 |
| `npm run beta:backup -- /安全目录/state.sqlite` | 创建一致的数据库备份 |
| `npm run typecheck` | 检查 TypeScript |

现行手机版包含整屏资料与聊天详情、悬浮导航、Scroll Reveal、轻微磁吸进入按钮、阻尼比 1 的弹簧滚动，以及图片原位展开与收回。真实手机、HTTPS 和实际模型/设备功能应在自己的部署环境验收。
