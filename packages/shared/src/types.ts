export const ROWS = 9;
export const COLS = 6;

export type PlayerId = 0 | 1;

export interface Cell {
  owner: PlayerId | null;
  count: number;
}

export type Board = Cell[][];

export interface Coord {
  r: number;
  c: number;
}

export interface Wave {
  exploded: Coord[];
  board: Board;
}

export interface GameState {
  board: Board;
  turn: PlayerId;
  moves: [number, number];
  winner: PlayerId | null;
}
