import type { ServerWebSocket } from "bun";
import { CONFIG } from "./config";
import { Game } from "./game";
import type { Seat } from "./game";
import { destroySession } from "./session";
import type { Session, WebSocketData } from "./session";

const games = new Map<string, Game>();
const queue: Session[] = [];

const fail = (s: Session, code: string, message: string) =>
  s.send({ type: "error", code, message });

const gameOf = (s: Session): Game | undefined =>
  s.gameId ? games.get(s.gameId) : undefined;

function startGame(seats: [Seat, Seat]): void {
  const game = new Game(crypto.randomUUID(), seats, (g) => games.delete(g.id));

  games.set(game.id, game);
  game.start();
}

function stopSearch(s: Session): void {
  if (s.searchTimer) clearTimeout(s.searchTimer);

  s.searchTimer = null;
  s.searching = false;

  const i = queue.indexOf(s);
  if (i >= 0) queue.splice(i, 1);
}

export function playBot(s: Session): void {
  if (s.gameId || s.searching)
    return fail(s, "busy", "Finish or cancel hat you were doing first.");

  startGame([
    { kind: "human", session: s },
    { kind: "bot", name: "Bot" },
  ]);
}

export function findMatch(s: Session): void {
  if (s.gameId || s.searching)
    return fail(s, "busy", "Finish or cancel hat you were doing first.");

  const opponent = queue.shift();
  if (opponent) {
    stopSearch(opponent);

    const seats: [Seat, Seat] = [
      { kind: "human", session: opponent },
      { kind: "human", session: s },
    ];

    if (Math.random() < 0.5) seats.reverse();

    startGame(seats);

    return;
  }

  s.searching = true;

  queue.push(s);

  s.searchTimer = setTimeout(() => {
    stopSearch(s);

    s.send({
      type: "search_timeout",
    });
  }, CONFIG.matchmakingTimeoutMs);

  s.send({
    type: "searching",
    timeoutMs: CONFIG.matchmakingTimeoutMs,
  });
}

export function cancelSearch(s: Session): void {
  if (!s.searching) return;

  stopSearch(s);
  s.send({ type: "search_cancelled" });
}

export function handleMove(s: Session, r: number, c: number): void {
  const game = gameOf(s);
  const seat = game?.seatOf(s) ?? null;

  if (!game || seat === null)
    return fail(s, "no_game", "You are not in a game");

  const error = game.move(seat, r, c);
  if (error) fail(s, error, "Move rejected");
}

export function resign(s: Session): void {
  const game = gameOf(s);
  const seat = game?.seatOf(s) ?? null;

  if (game && seat !== null) game.resign(seat);
}

export function onConnect(
  s: Session,
  ws: ServerWebSocket<WebSocketData>,
): void {
  if (s.ws && s.ws !== ws) s.ws.close(4000, "replaced by newer connection");

  if (s.reapTimer) clearTimeout(s.reapTimer);

  s.reapTimer = null;
  s.ws = ws;

  ws.data.session = s;

  s.send({ type: "welcome", token: s.token, username: s.username });

  const game = gameOf(s);
  const seat = game?.seatOf(s) ?? null;

  if (game && seat !== null) game.playerReconnected(seat);
}

export function onDisconnect(s: Session): void {
  s.ws = null;

  if (s.searching) stopSearch(s);

  const game = gameOf(s);
  const seat = game?.seatOf(s) ?? null;

  if (game && seat !== null) game.playerDisconnected(seat);

  s.reapTimer = setTimeout(() => destroySession(s), CONFIG.reapAfterMs);
}
