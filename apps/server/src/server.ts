import type { ServerWebSocket } from "bun";
import { ClientMessageSchema } from "@chain/shared";
import type { ClientMessage } from "@chain/shared";
import { CONFIG } from "./config";
import * as lobby from "./lobby";
import { TokenBucket } from "./rateLimit";
import { createSession, findByToken } from "./session";
import type { WebSocketData } from "./session";
import { cleanUsername } from "./validation";

type Ws = ServerWebSocket<WebSocketData>;
type Hello = Extract<ClientMessage, { type: "hello" }>;

const connectionsPerIP = new Map<string, number>();

function reply(ws: Ws, code: string, message: string): void {
  ws.send(JSON.stringify({ type: "error", code, message }));
}

function finishHello(ws: Ws): void {
  if (ws.data.helloTimer) clearTimeout(ws.data.helloTimer);

  ws.data.helloTimer = null;
}

function handleHello(ws: Ws, msg: Hello): void {
  if (ws.data.session)
    return reply(ws, "already_signed_in", "You are already signed in.");

  if (msg.token) {
    const existing = findByToken(msg.token);
    if (!existing) return reply(ws, "invalid_token", "Your session expired.");

    finishHello(ws);

    lobby.onConnect(existing, ws);

    return;
  }

  const name = cleanUsername(msg.username);
  if (!name)
    return reply(
      ws,
      "invalid_username",
      "Use 3 to 16 letters, numbers or underscores.",
    );

  const session = createSession(name);
  if (!session)
    return reply(ws, "username_taken", "That username is in use right now.");

  finishHello(ws);

  lobby.onConnect(session, ws);
}

function onMessage(ws: Ws, raw: string | Buffer): void {
  if (!ws.data.bucket.take()) {
    ws.close(1008, "rate limit exceeded");
    return;
  }

  if (typeof raw !== "string") {
    ws.close(1003, "text frames only");
    return;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return reply(ws, "bad_json", "Invalid JSON");
  }

  const parsed = ClientMessageSchema.safeParse(json);
  if (!parsed.success) return reply(ws, "bad_message", "Unrecognized message.");

  const msg = parsed.data;

  if (msg.type == "hello") return handleHello(ws, msg);

  const session = ws.data.session;
  if (!session) return reply(ws, "not_signed_in", "Send hello first.");

  switch (msg.type) {
    case "play_bot":
      return lobby.playBot(session);
    case "find_match":
      return lobby.findMatch(session);
    case "cancel_search":
      return lobby.cancelSearch(session);
    case "move":
      return lobby.handleMove(session, msg.r, msg.c);
    case "resign":
      return lobby.resign(session);
  }
}

export function createServer(port: number) {
  return Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname == "/health") return new Response("ok");
      if (url.pathname !== "/ws")
        return new Response("Not Found", { status: 404 });

      const origin = req.headers.get("origin");
      if (!origin || !CONFIG.allowedOrigins.includes(origin)) {
        return new Response("Forbidden", { status: 403 });
      }

      const ip =
        req.headers.get("fly-client-ip") ??
        server.requestIP(req)?.address ??
        "unknown";
      if ((connectionsPerIP.get(ip) ?? 0) >= CONFIG.maxConnectionsPerIP) {
        return new Response("Too mny connections", { status: 429 });
      }

      const data: WebSocketData = {
        ip,
        session: null,
        helloTimer: null,
        bucket: new TokenBucket(CONFIG.rateCapacity, CONFIG.rateRefillPerSec),
      };

      if (server.upgrade(req, { data })) return undefined;

      return new Response("Upgrade failed", { status: 400 });
    },
    websocket: {
      maxPayloadLength: CONFIG.maxMessageBytes,
      idleTimeout: 120,
      open(ws) {
        connectionsPerIP.set(
          ws.data.ip,
          (connectionsPerIP.get(ws.data.ip) ?? 0) + 1,
        );

        ws.data.helloTimer = setTimeout(
          () => ws.close(4001, "hello timeout"),
          CONFIG.helloTimeoutMs,
        );
      },
      message(ws, raw) {
        onMessage(ws, raw);
      },
      close(ws) {
        const left = (connectionsPerIP.get(ws.data.ip) ?? 1) - 1;

        if (left <= 0) connectionsPerIP.delete(ws.data.ip);
        else connectionsPerIP.set(ws.data.ip, left);

        finishHello(ws);

        const session = ws.data.session;

        if (session && session.ws === ws) lobby.onDisconnect(session);
      },
    },
  });
}
