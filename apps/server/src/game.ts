import { isLegal, newGame, other, passTurn, play } from "@chain/shared";
import type {
  EndReason,
  GameMode,
  GameState,
  PlayerId,
  ServerMessage,
} from "@chain/shared";
import { chooseBotMove } from "./bot";
import { CONFIG } from "./config";
import type { Session } from "./session";

type Timer = ReturnType<typeof setTimeout>;

export type Seat =
  | { kind: "human"; session: Session }
  | { kind: "bot"; name: string };

export class Game {
  private state: GameState = newGame();
  private missed: [number, number] = [0, 0];
  private deadline = 0;
  private over = false;
  private turnTimer: Timer | null = null;
  private graceTimers: [Timer | null, Timer | null] = [null, null];

  constructor(
    readonly id: string,
    private seats: [Seat, Seat],
    private onEnd: (game: Game) => void,
  ) {}

  get mode(): GameMode {
    return this.seats.some((s) => s.kind == "bot") ? "bot" : "pvp";
  }

  seatOf(session: Session): PlayerId | null {
    const i = this.seats.findIndex(
      (s) => s.kind == "human" && s.session == session,
    );

    return i == 0 || i == 1 ? i : null;
  }

  start(): void {
    for (const seat of this.seats) {
      if (seat.kind == "human") seat.session.gameId = this.id;
    }

    this.armTurn();

    this.seats.forEach((_, i) =>
      this.sendTo(i as PlayerId, this.snapshot(i as PlayerId)),
    );
  }

  snapshot(you: PlayerId): ServerMessage {
    const opp = this.seats[other(you)];

    return {
      type: "game_state",
      gameId: this.id,
      mode: this.mode,
      you,
      opponent: opp.kind == "bot" ? opp.name : opp.session.username,
      board: this.state.board,
      turn: this.state.turn,
      turnMs: this.turnMs(),
      opponentConnected: opp.kind == "bot" || opp.session.ws !== null,
    };
  }

  move(player: PlayerId, r: number, c: number): string | null {
    if (this.over) return "game-over";
    if (this.state.turn !== player) return "not_your_turn";
    if (!isLegal(this.state, r, c)) return "illegal_move";

    const result = play(this.state, r, c);

    this.state = result.state;
    this.missed[player] = 0;

    if (this.state.winner == null) this.armTurn();

    this.broadcast({
      type: "move_applied",
      by: player,
      r,
      c,
      waves: result.waves,
      board: this.state.board,
      turn: this.state.turn,
      turnMs: this.turnMs(),
    });

    if (this.state.winner !== null) this.end(this.state.winner, "elimination");

    return null;
  }

  resign(player: PlayerId): void {
    this.end(other(player), "resigned");
  }

  playerDisconnected(player: PlayerId): void {
    if (this.over) return;

    this.sendTo(other(player), { type: "opponent_status", connected: false });

    this.graceTimers[player] = setTimeout(
      () => this.end(other(player), "disconnect"),
      CONFIG.reconnectGraceMs,
    );
  }

  playerReconnected(player: PlayerId): void {
    const timer = this.graceTimers[player];
    if (timer) clearTimeout(timer);

    this.graceTimers[player] = null;

    this.sendTo(player, this.snapshot(player));
    this.sendTo(other(player), { type: "opponent_status", connected: true });
  }

  //---- Internal Functions--------------
  private armTurn(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);

    if (this.seats[this.state.turn].kind == "bot") {
      this.turnTimer = setTimeout(() => this.botMove(), CONFIG.botDelayMs);
    } else {
      this.deadline = Date.now() + CONFIG.turnTimeoutMs;
      this.turnTimer = setTimeout(
        () => this.onTurnTimeout(),
        CONFIG.turnTimeoutMs,
      );
    }
  }

  private turnMs(): number | null {
    if (this.seats[this.state.turn].kind == "bot") return null;

    return Math.max(0, this.deadline - Date.now());
  }

  private botMove(): void {
    if (this.over) return;

    const player = this.state.turn;
    const [r, c] = chooseBotMove(this.state, player);

    this.move(player, r, c);
  }

  private onTurnTimeout(): void {
    if (this.over) return;

    const player = this.state.turn;
    this.missed[player] += 1;

    if (this.missed[player] >= CONFIG.maxMissedTurns) {
      this.end(other(player), "forfeit");

      return;
    }

    this.state = passTurn(this.state);
    this.armTurn();
    this.broadcast({
      type: "turn_skipped",
      player,
      missed: this.missed[player],
      turn: this.state.turn,
      turnMs: this.turnMs(),
    });
  }

  private end(winner: PlayerId, reason: EndReason): void {
    if (this.over) return;

    this.over = true;

    if (this.turnTimer) clearTimeout(this.turnTimer);

    for (const t of this.graceTimers) if (t) clearTimeout(t);

    this.broadcast({
      type: "game_over",
      winner,
      reason,
    });

    for (const seat of this.seats) {
      if (seat.kind === "human") seat.session.gameId = null;
    }

    this.onEnd(this);
  }

  private sendTo(player: PlayerId, msg: ServerMessage): void {
    const seat = this.seats[player];

    if (seat.kind == "human") seat.session.send(msg);
  }

  private broadcast(msg: ServerMessage): void {
    this.sendTo(0, msg);
    this.sendTo(1, msg);
  }
}
