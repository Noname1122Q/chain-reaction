import {
  countOrbs,
  criticalMass,
  legalMoves,
  neighbors,
  other,
  play,
} from "@chain/shared";
import type { Board, GameState, PlayerId } from "@chain/shared";

function exposure(board: Board, me: PlayerId): number {
  let penalty = 0;

  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c].owner !== me) continue;

      const threatened = neighbors(r, c).some((n) => {
        const cell = board[n.r][n.c];

        return (
          cell.owner === other(me) && cell.count === criticalMass(n.r, n.c) - 1
        );
      });

      if (threatened) penalty += board[r][c].count + 1;
    }
  }

  return penalty;
}

export function chooseBotMove(
  state: GameState,
  me: PlayerId,
): [number, number] {
  const opp = other(me);

  let best: [number, number] | null = null;
  let bestScore = -Infinity;

  for (const [r, c] of legalMoves(state)) {
    const { state: after } = play(state, r, c);
    if (after.winner === me) return [r, c];

    let score = countOrbs(after.board, me) - countOrbs(after.board, opp);
    score -= exposure(after.board, me);
    score += 4 - criticalMass(r, c);
    score += Math.random() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = [r, c];
    }
  }

  return best ?? legalMoves(state)[0];
}
