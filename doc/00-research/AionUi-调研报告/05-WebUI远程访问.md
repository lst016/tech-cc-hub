# AionUi 调研报告 - WebUI 远程访问模块

**模块**: `src/process/webserver/`
**调研时间**: 2026-05-01

---

## 一、模块结构

```
webserver/
├── adapter.ts              # 适配器初始化
├── auth/                   # 认证模块
│   ├── index.ts
│   ├── middleware/
│   ├── repository/
│   └── service/
├── config/
│   └── constants.ts        # 配置常量
├── directoryApi.ts        # 目录 API
├── index.ts               # 服务入口
├── middleware/            # 中间件
├── routes/                # 路由
│   ├── authRoutes.ts      # 认证路由
│   ├── apiRoutes.ts       # API 路由
│   └── staticRoutes.ts    # 静态资源
├── setup.ts               # 设置函数
├── types/                 # 类型定义
└── websocket/
    └── WebSocketManager.ts  # WebSocket 管理
```

---

## 二、WebUI 服务架构

### 2.1 启动流程 (index.ts)

```typescript
// Express + WebSocket 组合服务器
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// 注册中间件
setupBasicMiddleware(app);
setupCors(app);
setupErrorHandler(app);

// 注册路由
registerAuthRoutes(app);
registerApiRoutes(app);
registerStaticRoutes(app);

// 初始化 WebSocket
initWebAdapter(wss);
const wsManager = new WebSocketManager(wss);
wsManager.initialize();
wsManager.setupConnectionHandler(handleMessage);

// 启动服务器
httpServer.listen(port, () => {
  console.log(`[WebUI] Server running on port ${port}`);
});
```

### 2.2 IP 地址获取

```typescript
function getLanIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;

    for (const iface of netInfo) {
      // 跳过内部地址（127.0.0.1）和 IPv6
      const isIPv4 = iface.family === 'IPv4';
      const isNotInternal = !iface.internal;
      if (isIPv4 && isNotInternal) {
        return iface.address;
      }
    }
  }
  return null;
}
```

---

## 三、WebSocket 管理

### 3.1 WebSocketManager 核心

```typescript
export class WebSocketManager {
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  initialize(): void {
    this.startHeartbeat();
  }

  setupConnectionHandler(onMessage: (name: string, data: any, ws: WebSocket) => void): void {
    this.wss.on('connection', async (ws, req) => {
      // 缓冲认证期间的消息
      const pendingMessages: Buffer[] = [];
      const bufferMessage = (raw: Buffer) => pendingMessages.push(raw);
      ws.on('message', bufferMessage);

      const token = TokenMiddleware.extractWebSocketToken(req);

      if (!(await this.validateConnection(ws, token))) {
        return;
      }

      this.addClient(ws, token!);
      this.setupMessageHandler(ws, onMessage);

      // 重放认证期间缓冲的消息
      for (const raw of pendingMessages) {
        ws.emit('message', raw, false);
      }
    });
  }
}
```

### 3.2 连接验证

```typescript
private async validateConnection(ws: WebSocket, token: string | null): Promise<boolean> {
  if (!token) {
    ws.close(CLOSE_CODES.POLICY_VIOLATION, 'No token provided');
    return false;
  }

  if (!(await TokenMiddleware.validateWebSocketToken(token))) {
    // 发送 auth-expired 后再关闭，让客户端重定向到登录
    ws.send(JSON.stringify({ name: 'auth-expired', data: {...} }));
    ws.close(CLOSE_CODES.POLICY_VIOLATION, 'Invalid or expired token');
    return false;
  }

  return true;
}
```

### 3.3 心跳检测

```typescript
private startHeartbeat(): void {
  this.heartbeatTimer = setInterval(() => {
    this.checkClients();
  }, WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);
}

private checkClients(): void {
  const now = Date.now();
  const timeout = WEBSOCKET_CONFIG.HEARTBEAT_TIMEOUT;

  for (const [ws, info] of this.clients) {
    if (now - info.lastPing > timeout) {
      // 发送 auth-expired 后关闭
      ws.send(JSON.stringify({ name: 'auth-expired', ... }));
      ws.close(CLOSE_CODES.POLICY_VIOLATION, 'Heartbeat timeout');
      this.removeClient(ws);
    } else {
      ws.send(JSON.stringify({ name: 'ping' }));
    }
  }
}
```

### 3.4 消息处理

```typescript
private setupMessageHandler(ws: WebSocket, onMessage: ...) {
  ws.on('message', (rawData) => {
    const parsed = JSON.parse(rawData.toString());
    const { name, data } = parsed;

    if (name === 'pong') {
      this.updateLastPing(ws);
      return;
    }

    if (name === 'subscribe-show-open') {
      this.handleFileSelection(ws, data);
      return;
    }

    onMessage(name, data, ws);
  });
}
```

---

## 四、认证服务

### 4.1 AuthService

```typescript
export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static jwtSecret: string | null = null;
  private static readonly TOKEN_EXPIRY = '24h';

  // Token 黑名单
  private static tokenBlacklist: Map<string, number> = new Map();

  // Token 加入黑名单
  public static blacklistToken(token: string): void {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiry = decoded?.exp ? decoded.exp * 1000 : Date.now() + COOKIE_MAX_AGE;
    this.tokenBlacklist.set(tokenHash, expiry);
  }

  // 验证 Token
  public static verifyToken(token: string): TokenPayload | null {
    if (this.isBlacklisted(token)) return null;
    return jwt.verify(token, this.getJwtSecret()) as TokenPayload;
  }
}
```

### 4.2 JWT 配置

```typescript
export const AUTH_CONFIG = {
  TOKEN: {
    SESSION_EXPIRY: '24h',           // 会话过期
    WEBSOCKET_EXPIRY: '5m',          // WebSocket Token
    COOKIE_MAX_AGE: 30 * 24 * 60 * 60 * 1000,  // 30 天
  },

  RATE_LIMIT: {
    LOGIN_MAX_ATTEMPTS: 5,
    WINDOW_MS: 15 * 60 * 1000,
  },

  COOKIE: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
  },
};
```

---

## 五、WebSocket 配置

```typescript
export const WEBSOCKET_CONFIG = {
  HEARTBEAT_INTERVAL: 30000,     // 30 秒
  HEARTBEAT_TIMEOUT: 60000,       // 60 秒
  CLOSE_CODES: {
    POLICY_VIOLATION: 1008,
    NORMAL_CLOSURE: 1000,
  },
};
```

---

## 六、tech-cc-hub 借鉴建议

### 6.1 可直接借鉴

| 功能 | AionUi 实现 | 移植价值 |
|------|-------------|----------|
| **WebSocket 管理模式** | 客户端映射 + 心跳 | 高 |
| **Token 黑名单** | 防登出后 token 被滥用 | 中 |
| **认证期间消息缓冲** | 防止认证期间消息丢失 | 高 |
| **心跳检测** | 保持连接健康 | 中 |

### 6.2 需要适配

| 功能 | 差异点 |
|------|--------|
| **用户系统** | 我们无用户系统 |
| **JWT 认证** | 需要简化或移除 |
| **多客户端支持** | 适配我们的会话模型 |

### 6.3 简化实现方案

```typescript
// tech-cc-hub 简化版 WebSocketManager
export class SimpleWebSocketManager {
  private clients: Map<WebSocket, { sessionId: string; lastPing: number }> = new Map();

  setupConnectionHandler(onMessage: (name: string, data: any, ws: WebSocket) => void): void {
    this.wss.on('connection', (ws, req) => {
      // 从 URL 参数获取 sessionId
      const url = new URL(req.url, 'ws://localhost');
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        ws.close(1008, 'No sessionId');
        return;
      }

      this.addClient(ws, sessionId);
      this.setupMessageHandler(ws, onMessage);
    });
  }
}
```

### 6.4 实现优先级

| 优先级 | 功能 | 工作量 |
|--------|------|--------|
| P0 | WebSocket 管理器核心 | 2 days |
| P0 | 连接验证 | 1 day |
| P1 | 心跳检测 | 1 day |
| P2 | 远程认证 | 3 days |
| P3 | 二维码登录 | 5 days |

---

**文档路径**: `doc/00-research/AionUi-调研报告/05-WebUI远程访问.md`
