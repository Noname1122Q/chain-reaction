import { Board, COLS, Coord, GameState, PlayerId, ROWS, Wave } from "./types";

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

export function isLegal(state: GameState, r: number, c: number): boolean {
  if (state.winner !== null || !inBounds(r, c)) return false;

  const owner = state.board[r][c].owner;

  return owner === null || owner === state.turn;
}

export function legalMoves(state: GameState): Array<[number, number]> {
  const moves: Array<[number, number]> = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isLegal(state, r, c)) moves.push([r, c]);
    }
  }

  return moves;
}

export function play(
  state: GameState,
  r: number,
  c: number,
): { state: GameState; waves: Wave[] } {
  if (!isLegal(state, r, c)) throw new Error("Illegal move");

  const player = state.turn;
  const board = cloneBoard(state.board);

  const moves: [number, number] = [state.moves[0], state.moves[1]];
  moves[player] += 1;

  const bothHaveMoved = moves[0] > 0 && moves[1] > 0;

  board[r][c].owner = player;
  board[r][c].count += 1;

  const waves: Wave[] = [];
  while (waves.length < MAX_WAVES) {
    const unstable: Coord[] = [];

    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        if (board[i][j].count >= criticalMass(i, j))
          unstable.push({ r: i, c: j });
      }
    }

    if (unstable.length == 0) break;

    for (const { r: ur, c: uc } of unstable) {
      const cell = board[ur][uc];
      cell.count -= criticalMass(ur, uc);

      if (cell.count === 0) cell.owner = null;

      for (const n of neighbors(ur, uc)) {
        board[n.r][n.c].count += 1;
        board[n.r][n.c].owner = player;
      }
    }

    waves.push({ exploded: unstable, board: cloneBoard(board) });

    if (bothHaveMoved && soleOwner(board) !== null) break;
  }

  const winner = bothHaveMoved ? soleOwner(board) : null;

  return { state: { board, turn: other(player), moves, winner }, waves };
}

export function passTurn(state: GameState): GameState {
  return { ...state, turn: other(state.turn) };
}
