<div align="center">

<a href="https://github.com/SWZDL/h-ui"><img src="./docs/images/head-cover.png" alt="H UI" width="150" /></a>

<h1 align="center">H UI</h1>

English / [简体中文](README_ZH.md)

Just the panel for Hysteria2

<p>
<a href="https://www.gnu.org/licenses/gpl-3.0.html"><img src="https://img.shields.io/github/license/SWZDL/h-ui" alt="License: GPL-3.0"></a>
<a href="https://github.com/SWZDL/h-ui/stargazers"><img src="https://img.shields.io/github/stars/SWZDL/h-ui" alt="GitHub stars"></a>
<a href="https://github.com/SWZDL/h-ui/forks"><img src="https://img.shields.io/github/forks/SWZDL/h-ui" alt="GitHub forks"></a>
<a href="https://github.com/SWZDL/h-ui/releases"><img src="https://img.shields.io/github/v/release/SWZDL/h-ui" alt="GitHub release"></a>
<a href="https://github.com/SWZDL/h-ui/pkgs/container/h-ui"><img src="https://img.shields.io/badge/ghcr.io-h--ui-2496ED" alt="GHCR"></a>
</p>

![cover](./docs/images/cover.png)

</div>

## Features

- Lightweight, low resource usage, easy to deploy
- Monitor system status and Hysteria2 status
- Limit user traffic, user online status, force users to log off, number of online users, reset user traffic
- Limit the number of users' online devices at the same time, the number of online devices
- User subscription link, node URL, import and export users
- Managing Hysteria2 configurations and Hysteria2 versions, port hopping
- Change the Web port, modify the Hysteria2 traffic multiplier
- Telegram notification
- View, import, and export system logs and Hysteria2 logs
- I18n: English, 简体中文, Русский
- Page adaptation, support night mode, custom page themes
- New React 19 + shadcn/ui frontend (default) with the legacy Vue UI available via `--web vue`
- More features waiting for you to discover

## Recommended OS

OS: CentOS 8+/Ubuntu 20+/Debian 11+

CPU: x86_64/amd64 arm64/aarch64

Memory: ≥ 256MB

## Deployment

### Quick Install (Recommended)

Install Latest Version

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/SWZDL/h-ui/main/install.sh)
```

Install [Custom Version](https://github.com/SWZDL/h-ui/releases)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/SWZDL/h-ui/main/install.sh) v0.1.0
```

### systemd

Executable files: https://github.com/SWZDL/h-ui/releases

```bash
mkdir -p /usr/local/h-ui/
curl -fsSL https://github.com/SWZDL/h-ui/releases/latest/download/h-ui-linux-amd64 -o /usr/local/h-ui/h-ui && chmod +x /usr/local/h-ui/h-ui
curl -fsSL https://raw.githubusercontent.com/SWZDL/h-ui/main/h-ui.service -o /etc/systemd/system/h-ui.service
# Custom web port, default is 8081
# sed -i "s|^ExecStart=.*|ExecStart=/usr/local/h-ui/h-ui -p 8081|" "/etc/systemd/system/h-ui.service"
systemctl daemon-reload
systemctl enable h-ui
systemctl restart h-ui
```

Uninstall

```bash
systemctl stop h-ui
rm -rf /etc/systemd/system/h-ui.service /usr/local/h-ui/
```

### Docker

1. Install Docker

   https://docs.docker.com/engine/install/

   ```bash
   bash <(curl -fsSL https://get.docker.com)
   ```

2. Start a container

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

   > The image is built and pushed to GHCR by the release workflow. Set the
   > package visibility to **Public** in GitHub Packages, otherwise anonymous
   > `docker pull` requests will be rejected.

   Custom web port, default is 8081

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

   Set the time zone, default is Asia/Shanghai

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

Uninstall

```bash
docker rm -f h-ui
docker rmi ghcr.io/swzdl/h-ui
rm -rf /h-ui
```

## Default Installation Information

- Panel Port: 8081
- SSH local forwarded port: 8082

Automatic Installation ([install.sh](install.sh)):

- Login Username/Password: Random 6 characters
- Connection Password: {Login Username}.{Login Password}

Manual Installation:

- Login Username/Password: sysadmin/sysadmin
- Connection Password: sysadmin.sysadmin

Note: Only the system administrator can log in.

## System Upgrade

Export the user, system configuration, and Hysteria2 configuration in the management background, redeploy the latest
version of h-ui, and import the data into the management background after the deployment is complete.

## FAQ

[English > FAQ](./docs/FAQ.md)

## Performance Optimization

- Scheduled server restart

    ```bash
    0 4 * * * /sbin/reboot
    ```

- Install Network Accelerator
    - [TCP Brutal](https://github.com/apernet/tcp-brutal) (Recommended)
    - [teddysun/across#bbrsh](https://github.com/teddysun/across#bbrsh)
    - [Chikage0o0/Linux-NetSpeed](https://github.com/ylx2016/Linux-NetSpeed)
    - [ylx2016/Linux-NetSpeed](https://github.com/ylx2016/Linux-NetSpeed)

## Client

https://v2.hysteria.network/docs/getting-started/3rd-party-apps/

## Development

Go >= 1.20, Node.js >= 18.12.0

Two frontends ship with the panel and share the same API:

| Directory        | Stack                        | Notes                    |
| ---------------- | ---------------------------- | ------------------------ |
| `frontend_react` | React 19 + Vite + shadcn/ui  | Default frontend         |
| `frontend`       | Vue 3 + Element Plus         | Legacy frontend          |

- Default frontend (`frontend_react`)

   ```bash
   cd frontend_react
   npm install
   npm run dev
   ```

- Legacy frontend (`frontend`)

   ```bash
   cd frontend
   pnpm install
   npm run dev
   ```

- Backend

   ```bash
   go run main.go
   ```

Pick the frontend at startup with `--web` (or the `H_UI_WEB_FRONTEND` environment
variable). React is the default:

```bash
./h-ui -p 8081 --web react   # default
./h-ui -p 8081 --web vue     # legacy Vue frontend

H_UI_WEB_FRONTEND=vue ./h-ui -p 8081
```

Precedence: `--web` > `H_UI_WEB_FRONTEND` > `react`.

## Build

Both frontends are embedded into the Go binary, so build **both** dist folders
before compiling (or at least make sure `frontend/dist` and
`frontend_react/dist` exist):

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

## Other

Telegram Channel: https://t.me/jonssonyan_channel

You can subscribe to my channel on YouTube: https://www.youtube.com/@jonssonyan

## Contributors

Thanks to everyone who contributed to this project.

<a href="https://github.com/SWZDL/h-ui/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SWZDL/h-ui" />
</a>

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=SWZDL/h-ui&type=Date)](https://star-history.dera.page/#SWZDL/h-ui&Date)

## License

[GPL-3.0](LICENSE)