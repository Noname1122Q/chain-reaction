import { ServerWebSocket } from "bun";
import { TokenBucket } from "./rateLimit";
import { ServerMessage } from "../../../packages/shared/src";

type Timer = ReturnType<typeof setTimeout>;

export interface WebSocketData {
  ip: string;
  bucket: TokenBucket;
  session: Session | null;
  helloTimer: Timer | null;
}

export class Session {
  ws: ServerWebSocket<WebSocketData> | null = null;
  gameId: string | null = null;
  searching = false;
  searchTimer: Timer | null = null;
  reapTimer: Timer | null = null;

  constructor(
    readonly token: string,
    readonly username: string,
  ) {}

  send(msg: ServerMessage): void {
    this.ws?.send(JSON.stringify(msg));
  }
}

const byToken = new Map<string, Session>();
const byName = new Map<string, Session>();

export function createSession(username: string): Session | null {
  const key = username.toLowerCase();

  if (byName.has(key)) return null;

  const session = new Session(crypto.randomUUID(), username);

  byToken.set(session.token, session);
  byName.set(key, session);

  return session;
}

export const findByToken = (token: string): Session | undefined => {
  return byToken.get(token);
};

export function destroySession(session: Session): void {
  if (session.reapTimer) clearTimeout(session.reapTimer);

  byToken.delete(session.token);
  byName.delete(session.username.toLowerCase());
}
