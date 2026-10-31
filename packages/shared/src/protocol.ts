import z from "zod";
import { ROWS, COLS } from "./types";
import type { Board, PlayerId, Wave } from "./types";

const simple = <T extends string>(type: T) =>
  z.object({ type: z.literal(type) }).strict();

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("hello"),
      username: z.string().max(32).optional(),
      token: z.string().uuid().optional(),
    })
    .strict(),
  simple("play_bot"),
  simple("find_match"),
  simple("cancel_search"),
  simple("resign"),
  z
    .object({
      type: z.literal("move"),
      r: z
        .number()
        .int()
        .min(0)
        .max(ROWS - 1),
      c: z
        .number()
        .int()
        .min(0)
        .max(COLS - 1),
    })
    .strict(),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type EndReason = "elimination" | "forfeit" | "resigned" | "disconnect";
export type GameMode = "bot" | "pvp";

export type ServerMessage =
  | { type: "welcome"; token: string; username: string }
  | { type: "error"; code: string; message: string }
  | { type: "searching"; timeoutMs: number }
  | { type: "search_timeout" }
  | { type: "search_cancelled" }
  | {
      type: "game_state";
      gameId: string;
      mode: GameMode;
      you: PlayerId;
      opponent: string;
      board: Board;
      turn: PlayerId;
      turnMs: number | null;
      opponentConnected: boolean;
    }
  | {
      type: "move_applied";
      by: PlayerId;
      r: number;
      c: number;
      waves: Wave[];
      board: Board;
      turn: PlayerId;
      turnMs: number | null;
    }
  | {
      type: "turn_skipped";
      player: PlayerId;
      missed: number;
      turn: PlayerId;
      turnMs: number | null;
    }
  | {
      type: "opponent_status";
      connected: boolean;
    }
  | {
      type: "game_over";
      winner: PlayerId;
      reason: EndReason;
    };
