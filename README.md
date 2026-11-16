# 智域手机版

智域手机版的可部署源码，包含手机界面、独立账号、七位智友、聊天与群聊、动态圈、任务、Molly 报告，以及内测后台和问卷。2026-11-16 更新：邀请码入口暂时隐藏，默认使用账号注册和登录；邀请码功能完整保留。

手机入口：`/mobile`。后台入口：`/admin`。部署后，将你的 **HTTPS 域名 + `/mobile`** 发给用户，用户可自行注册账号并登录，无需邀请码。仍需成年确认，每个账号的数据独立保存。

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

用编辑器在 `../zhiyu-private/zhiyu.env` 填入自己的模型服务凭证。若要使用管理员后台，先设置创始人后台密码（普通用户注册不需要这一步）：

```sh
ZHIYU_ENV_FILE=../zhiyu-private/zhiyu.env npm run beta:admin
```

选择 `founder`，按终端提示输入密码；若需要投资人只读后台，再执行一次并选择 `investor`。随后启动：

```sh
ZHIYU_ENV_FILE=../zhiyu-private/zhiyu.env npm start
```

打开 [本地手机界面](http://127.0.0.1:3100/mobile)，选择注册或登录即可使用。注册时勾选成年确认。无需先初始化后台或生成邀请码才能注册；后台仅供管理员使用。

## 暂时隐藏邀请码，部署时重新开启

配置 `ZHIYU_INVITE_ONLY=0`（不设置时也默认关闭）后，显示正常账号注册和登录。设置 `ZHIYU_INVITE_ONLY=1` 并重启服务，即恢复原来的邀请码输入和成年确认，普通注册、密码登录同时由服务器关闭；仅隐藏输入框不能替代此服务端限制。

切换不删除账号、聊天或邀请码，不清空持久数据。原邀请码仍可对应原账号，停用码的限制继续有效；邀请码模式下，原普通账号的有效会话仍保留，退出后如需继续用密码登录，应先切回开放模式。管理员后台权限不随此开关放开。

## 部署到阿里云 / Linux 服务器

可以让阿里云 ECS 从本仓库拉取代码，然后使用 `distribution/beta/Dockerfile` 构建运行。准备域名和 HTTPS 反向代理，配置 `ZHIYU_PUBLIC_ORIGIN`、模型凭证，并持久保存 `.npc-runtime`。按当前计划，阿里云内测上线时把私有环境文件中的 `ZHIYU_INVITE_ONLY` 改为 `1`，再重启服务；本次没有连接或部署阿里云。

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
| `node scripts/test-beta-open-registration.mjs` | 用临时数据库验证开放注册、邀请码切换和账号隔离 |

现行手机版包含整屏资料与聊天详情、悬浮导航、轻微磁吸进入按钮及图片原位展开与收回。触控板/触摸使用系统原生滚动，非编辑区键盘滚动保留阻尼比 1；Scroll Reveal 与导航上滑反馈保留。本次桌面同款语音、长按菜单与转文字、整页返回及电脑预览中文拼音修复均已包含。真实手机、HTTPS 和实际模型/设备功能应在自己的部署环境验收。
