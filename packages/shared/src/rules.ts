import { Board, COLS, Coord, GameState, PlayerId, ROWS } from "./types";

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const MAX_WAVES = 1000;

export const other = (p: PlayerId) => (p == 0 ? 1 : 0);

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ owner: null, count: 0 })),
  );
}

export const cloneBoard = (b: Board): Board =>
  b.map((row) => row.map((cell) => ({ ...cell })));

export function inBounds(r: number, c: number): boolean {
  return (
    Number.isInteger(r) &&
    Number.isInteger(c) &&
    r >= 0 &&
    r < ROWS &&
    c >= 0 &&
    c < COLS
  );
}

export function neighbors(r: number, c: number): Coord[] {
  return DIRS.map(([dr, dc]) => ({ r: r + dr, c: c + dc })).filter((p) =>
    inBounds(p.r, p.c),
  );
}

export const criticalMass = (r: number, c: number) => neighbors(r, c).length;

export function countOrbs(board: Board, player: PlayerId) {
  let total = 0;

  for (const row of board)
    for (const cell of row) if (cell.owner === player) total += cell.count;

  return total;
}

function soleOwner(board: Board) {
  const a = countOrbs(board, 0);
  const b = countOrbs(board, 1);

  if (a > 0 && b == 0) return 0;
  if (b > 0 && a == 0) return 1;

  return null;
}

export function newGame(): GameState {
  return {
    board: createBoard(),
    turn: 0,
    moves: [0, 0],
    winner: null,
  };
}
