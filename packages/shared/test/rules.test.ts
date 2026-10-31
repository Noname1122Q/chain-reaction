import { describe, expect, test } from "bun:test";
import {
  COLS,
  ROWS,
  countOrbs,
  criticalMass,
  isLegal,
  legalMoves,
  newGame,
  passTurn,
  play,
} from "../src";
import type { GameState, PlayerId } from "../src";

const total = (s: GameState) => countOrbs(s.board, 0) + countOrbs(s.board, 1);

function position(
  cells: Array<[number, number, PlayerId, number]>,
  turn: PlayerId = 0,
): GameState {
  const s = newGame();
  for (const [r, c, owner, count] of cells) s.board[r][c] = { owner, count };

  return { ...s, turn, moves: [3, 3] };
}

describe("critical mass", () => {
  test("corners 2, edges 3, interior 4", () => {
    expect(criticalMass(0, 0)).toBe(2);
    expect(criticalMass(ROWS - 1, COLS - 1)).toBe(2);
    expect(criticalMass(0, 3)).toBe(3);
    expect(criticalMass(4, 0)).toBe(3);
    expect(criticalMass(4, 3)).toBe(4);
  });
});

describe("legal moves", () => {
  test("cannot play on opponent or outside board", () => {
    const s = play(newGame(), 0, 0).state;

    expect(isLegal(s, 0, 0)).toBe(false);
    expect(isLegal(s, -1, 0)).toBe(false);
    expect(isLegal(s, ROWS, 0)).toBe(false);
    expect(legalMoves(s).length).toBe(ROWS * COLS - 1);
  });

  test("passTurn flips the turn and changes nothing else", () => {
    const s = newGame();
    const passed = passTurn(s);

    expect(passed.turn).toBe(1);
    expect(passed.board).toEqual(s.board);
  });
});

describe("explosions", () => {
  test("a corner explodes at 2 orbs and spreads to its neighbors", () => {
    let s = newGame();
    s = play(s, 0, 0).state;
    s = play(s, 8, 5).state;

    const r = play(s, 0, 0);
    expect(r.waves.length).toBe(1);
    expect(r.state.board[0][0]).toEqual({ owner: null, count: 0 });
    expect(r.state.board[0][1]).toEqual({ owner: 0, count: 1 });
    expect(r.state.board[1][0]).toEqual({ owner: 1, count: 1 });
  });
});
