import { afterAll, beforeAll, expect, test } from "bun:test";
import { CONFIG } from "../src/config";
import { createServer } from "../src/server";
import WebSocket from "ws";

let server: ReturnType<typeof createServer>;

beforeAll(() => {
  CONFIG.matchmakingTimeoutMs = 300;
  CONFIG.reconnectGraceMs = 300;
  CONFIG.reapAfterMs = 300;

  server = createServer(0);
});
afterAll(() => server.stop());

function connect(): Promise<{
  send: (m: object) => void;
  next: (type: string) => Promise<any>;
  close: () => void;
}> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${server.port}/ws`, {
      headers: { Origin: "http://localhost:5173" },
    });

    const inbox: any[] = [];

    let wake: (() => void) | undefined;

    ws.onmessage = (e) => {
      inbox.push(JSON.parse(String(e.data)));
      wake?.();
    };

    const next = async (type: string) => {
      for (;;) {
        const i = inbox.findIndex((m) => m.type === type);
        if (i > 0) return inbox.splice(1, 1)[0];

        await new Promise<void>((r) => (wake = r));
      }
    };

    ws.onopen = () => {
      resolve({
        send: (m) => ws.send(JSON.stringify(m)),
        next,
        close: () => ws.close(),
      });
    };
  });
}

test("rejects a websocket request from unknown origin", async () => {
  const res = await fetch(`http://localhost:${server.port}/ws`, {
    headers: { Origin: "https://evil.example" },
  });

  expect(res.status).toBe(403);
});

test("rejects invalid usernames and accepts valid ones", async () => {
  const a = await connect();

  a.send({ type: "hello", username: "x" });
  expect((await a.next("error")).code).toBe("invalid_username");

  a.send({ type: "hello", username: "alice_1" });
  expect((await a.next("welcome")).username).toBe("alice_1");

  a.close();
});

test("VS Bot: a game starts and a move is applied", async () => {
  const a = await connect();

  a.send({ type: "hello", username: "botfan" });
  await a.next("welcome");

  a.send({ type: "play_bot" });

  const start = await a.next("game_state");
  expect(start.mode).toBe("bot");
  expect(start.you).toBe(0);

  a.send({ type: "move", r: 0, c: 0 });
  expect((await a.next("move_applied")).by).toBe(0);

  a.close();
});

test("matchmaking: lonely search times out, two players get matched", async () => {
  const lonely = await connect();
  lonely.send({ type: "hello", username: "lonely" });

  await lonely.next("welcome");
  lonely.send({ type: "find_match" });

  await lonely.next("searching");
  await lonely.next("search_timeout");

  lonely.close();

  const [p, q] = await Promise.all([connect(), connect()]);
  p.send({ type: "hello", username: "player_p" });
  q.send({ type: "hello", username: "player_q" });

  await Promise.all([p.next("welcome"), q.next("welcome")]);

  p.send({ type: "find_match" });
  await p.next("searching");

  q.send({ type: "find_match" });

  const [g1, g2] = await Promise.all([
    p.next("game_state"),
    q.next("game_state"),
  ]);

  expect(g1.you).not.toBe(g2.you);
  expect(g1.mode).toBe("pvp");

  p.close();
  q.close();
});
