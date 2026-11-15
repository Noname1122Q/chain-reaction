import { COLS, criticalMass, ROWS, type EndReason } from "@chain/shared";
import { useStore } from "../store";
import { useEffect, useState } from "react";

const REASONS: Record<EndReason, string> = {
  elimination: "all orbs captured",
  forfeit: "two missed turns in a row",
  resigned: "resignation",
  disconnect: "disconnection",
};

function Timer() {
  const deadline = useStore((s) => s.game?.deadline ?? null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(id);
  }, []);

  if (deadline === null) return null;

  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));

  return <span className={secs <= 10 ? "timer low" : "timer"}>{secs}s</span>;
}

function Board() {
  const game = useStore((s) => s.game);
  const move = useStore((s) => s.move);

  if (!game) return null;

  const canPlay = game.turn === game.you && game.winner === null && !game.busy;

  const style = {
    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
    grigTemplateRows: `repeat(${ROWS}, 1fr)`,
  };

  return (
    <div className="board" style={style}>
      {game.board.map((row, r) =>
        row.map((cell, c) => {
          const allowed = cell.owner == null || cell.owner === game.you;
          const boom = game.exploding.some((p) => p.r == r && p.c == c);
          const unstable = cell.count === criticalMass(r, c) - 1;
          const cls = [
            "cell",
            cell.owner == null ? "" : `p${cell.owner}`,
            boom ? "boom" : "",
          ];

          return (
            <button
              key={`${r}-${c}`}
              className={cls.join(" ")}
              disabled={!canPlay || !allowed}
              onClick={() => move(r, c)}
              aria-label={`Row ${r + 1}, Column ${c + 1}, ${cell.count} orbs`}
            >
              <span className={unstable ? "orbs fast" : "orbs"}>
                {Array.from({ length: cell.count }, (_, i) => (
                  <i key={i} className="orb" />
                ))}
              </span>
            </button>
          );
        }),
      )}
    </div>
  );
}

export function GameScreen() {
  const game = useStore((s) => s.game);
  const notice = useStore((s) => s.notice);
  const resign = useStore((s) => s.resign);
  const back = useStore((s) => s.backToLobby);

  if (!game) return null;

  const names =
    game.you === 0 ? ["You", game.opponent] : [game.opponent, "You"];
  const over = game.winner !== null;
  const turnText = over
    ? "Game over"
    : game.turn === game.you
      ? "Your turn"
      : "Opponent's turn";

  return (
    <section className="game">
      <header className="status">
        <span className="chip p0">{names[0]}</span>
        <span>vs</span>
        <span className="chip p1">{names[1]}</span>
      </header>
      <p className="turn">
        {turnText} <Timer />
      </p>
      {!game.opponentConnected && !over && (
        <p className="notice">
          Opponent disconnected. Waiting up to 30 seconds...
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}
      <Board />
      {over ? (
        <div className="overlay card">
          <h2>{game.winner === game.you ? "You win!" : "You lose"}</h2>
          <p>Reason: {REASONS[game.reason ?? "elimination"]}</p>
          <button onClick={back}>Back to lobby</button>
        </div>
      ) : (
        <button className="secondary" onClick={resign}>
          Resign
        </button>
      )}
    </section>
  );
}
