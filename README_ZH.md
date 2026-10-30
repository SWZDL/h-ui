<div align="center">

<a href="https://github.com/SWZDL/h-ui"><img src="./docs/images/head-cover.png" alt="H UI" width="150" /></a>

<h1 align="center">H UI</h1>

[English](README.md) / 简体中文

仅仅是 Hysteria2 的面板

<p>
<a href="https://www.gnu.org/licenses/gpl-3.0.html"><img src="https://img.shields.io/github/license/SWZDL/h-ui" alt="License: GPL-3.0"></a>
<a href="https://github.com/SWZDL/h-ui/stargazers"><img src="https://img.shields.io/github/stars/SWZDL/h-ui" alt="GitHub stars"></a>
<a href="https://github.com/SWZDL/h-ui/forks"><img src="https://img.shields.io/github/forks/SWZDL/h-ui" alt="GitHub forks"></a>
<a href="https://github.com/SWZDL/h-ui/releases"><img src="https://img.shields.io/github/v/release/SWZDL/h-ui" alt="GitHub release"></a>
<a href="https://github.com/SWZDL/h-ui/pkgs/container/h-ui"><img src="https://img.shields.io/badge/ghcr.io-h--ui-2496ED" alt="GHCR"></a>
</p>

![cover](./docs/images/cover.png)

</div>

## 主要功能

- 轻量级、资源占用低、易于部署
- 监控系统状态和 Hysteria2 状态
- 限制用户流量、用户在线状态、强制用户下线、在线用户数、重设用户流量
- 限制用户同时在线设备数、在线设备数量
- 用户订阅链接、节点URL、导入和导出用户
- 管理 Hysteria2 配置和 Hysteria2 版本、端口跳跃
- 更改 Web 端口、修改 Hysteria2 流量倍数
- Telegram 通知
- 查看、导入和导出系统日志和 Hysteria2 日志
- 多国语言支持: English, 简体中文, Русский
- 页面适配、支持夜间模式、自定义页面主题
- 全新 React 19 + shadcn/ui 前端（默认），可通过 `--web vue` 切回旧版 Vue 前端
- 更多功能等待你发现

## 建议系统

系统: CentOS 8+/Ubuntu 20+/Debian 11+

CPU: x86_64/amd64 arm64/aarch64

内存: ≥ 256MB

## 部署

### 快速安装 (推荐)

安装最新版

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/SWZDL/h-ui/main/install.sh)
```

安装[自定义版本](https://github.com/SWZDL/h-ui/releases)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/SWZDL/h-ui/main/install.sh) v0.1.0
```

### systemd

下载可执行文件: https://github.com/SWZDL/h-ui/releases

```bash
mkdir -p /usr/local/h-ui/
curl -fsSL https://github.com/SWZDL/h-ui/releases/latest/download/h-ui-linux-amd64 -o /usr/local/h-ui/h-ui && chmod +x /usr/local/h-ui/h-ui
curl -fsSL https://raw.githubusercontent.com/SWZDL/h-ui/main/h-ui.service -o /etc/systemd/system/h-ui.service
# 自定义 Web 端口，默认 8081
# sed -i "s|^ExecStart=.*|ExecStart=/usr/local/h-ui/h-ui -p 8081|" "/etc/systemd/system/h-ui.service"
systemctl daemon-reload
systemctl enable h-ui
systemctl restart h-ui
```

卸载

```bash
systemctl stop h-ui
rm -rf /etc/systemd/system/h-ui.service /usr/local/h-ui/
```

### 容器部署

1. 安装 Docker

   https://docs.docker.com/engine/install/

   ```bash
   bash <(curl -fsSL https://get.docker.com)
   ```

2. 启动容器

   ```bash
   docker pull ghcr.io/swzdl/h-ui

   docker run -d --cap-add=NET_ADMIN \
     --name h-ui --restart always \
     --network=host \
     -v /h-ui/bin:/h-ui/bin \
     -v /h-ui/data:/h-ui/data \
     -v /h-ui/export:/h-ui/export \
     -v /h-ui/logs:/h-ui/logs \
     ghcr.io/swzdl/h-ui
   ```

   > 镜像由发布流程构建并推送到 GHCR。请在 GitHub Packages 中把该包可见性设为
   > **Public**，否则匿名 `docker pull` 会失败。

   自定义 Web 端口，默认 8081

   ```bash
   docker run -d --cap-add=NET_ADMIN \
     --name h-ui --restart always \
     --network=host \
     -v /h-ui/bin:/h-ui/bin \
     -v /h-ui/data:/h-ui/data \
     -v /h-ui/export:/h-ui/export \
     -v /h-ui/logs:/h-ui/logs \
     ghcr.io/swzdl/h-ui \
     ./h-ui -p 8081
   ```

   设置时区，默认 Asia/Shanghai

   ```bash
   docker run -d --cap-add=NET_ADMIN \
     --name h-ui --restart always \
     --network=host \
     -e TZ=Asia/Shanghai \
     -v /h-ui/bin:/h-ui/bin \
     -v /h-ui/data:/h-ui/data \
     -v /h-ui/export:/h-ui/export \
     -v /h-ui/logs:/h-ui/logs \
     ghcr.io/swzdl/h-ui
   ```

卸载

```bash
docker rm -f h-ui
docker rmi ghcr.io/swzdl/h-ui
rm -rf /h-ui
```

## 默认安装信息

- 面板端口: 8081
- SSH 本地转发端口: 8082

自动安装([install.sh](install.sh)):

- 登录用户名/密码: 随机6位字符
- 连接密码: {登录用户名}.{登录密码}

手动安装:

- 登录用户名/密码: sysadmin/sysadmin
- 连接密码: sysadmin.sysadmin

注意: 所有账户均可登录。普通用户只能查看自己的配额、流量、订阅链接与节点链接，管理功能仅管理员可用。

## 系统升级

在管理后台将用户、系统配置、Hysteria2 配置导出，重新部署最新版的 h-ui，部署完成之后在管理后台将数据导入

## 常见问题

[简体中文 > 常见问题](./docs/FAQ_ZH.md)

## 性能优化

- 定时重启服务器

    ```bash
    0 4 * * * /sbin/reboot
    ```

- 安装网络加速
    - [TCP Brutal](https://github.com/apernet/tcp-brutal) (推荐)
    - [teddysun/across#bbrsh](https://github.com/teddysun/across#bbrsh)
    - [Chikage0o0/Linux-NetSpeed](https://github.com/ylx2016/Linux-NetSpeed)
    - [ylx2016/Linux-NetSpeed](https://github.com/ylx2016/Linux-NetSpeed)

## 客户端

https://v2.hysteria.network/zh/docs/getting-started/3rd-party-apps/

## 开发

Go >= 1.20, Node.js >= 18.12.0

项目内置两套前端，共用同一套 API：

| 目录             | 技术栈                          | 说明                     |
| ---------------- | ------------------------------- | ------------------------ |
| `frontend_react` | React 19 + Vite + shadcn/ui     | 默认前端                 |
| `frontend`       | Vue 3 + Element Plus            | 旧版前端，仍可切换使用   |

- 默认前端（`frontend_react`）

   ```bash
   cd frontend_react
   npm install
   npm run dev
   ```

- 旧版前端（`frontend`）

   ```bash
   cd frontend
   pnpm install
   npm run dev
   ```

- 后端

   ```bash
   go run main.go
   ```

启动时通过 `--web`（或环境变量 `H_UI_WEB_FRONTEND`）选择要使用的前端，默认使用 React：

```bash
./h-ui -p 8081 --web react   # 默认
./h-ui -p 8081 --web vue     # 使用旧版 Vue 前端

H_UI_WEB_FRONTEND=vue ./h-ui -p 8081
```

优先级：`--web` > `H_UI_WEB_FRONTEND` > 默认值 `react`。

## 构建

两套前端都会被编译进二进制文件，构建 Go 程序前需要先构建 **两个** 前端（或至少保证 `frontend/dist` 与 `frontend_react/dist` 均存在）：

- frontend_react

   ```bash
   cd frontend_react
   npm install
   npm run build:prod
   ```

- frontend

   ```bash
   cd frontend
   pnpm install
   npm run build:prod
   ```

- backend

  Windows: [build.bat](build.bat)

  Mac/Linux: [build.sh](build.sh)

## 其他

Telegram Channel: https://t.me/jonssonyan_channel

你可以在 YouTube 上订阅我的频道: https://www.youtube.com/@jonssonyan

## 贡献者

在这里感谢所有为此项目做出贡献的人

<a href="https://github.com/SWZDL/h-ui/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SWZDL/h-ui" />
</a>

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=SWZDL/h-ui&type=Date)](https://star-history.dera.page/#SWZDL/h-ui&Date)

## 开源协议

[GPL-3.0](LICENSE)