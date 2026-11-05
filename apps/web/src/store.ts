import { create } from "zustand";
import type {
  Board,
  ClientMessage,
  Coord,
  EndReason,
  PlayerId,
  ServerMessage,
} from "@chain/shared";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001/ws";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Screen = "username" | "lobby" | "searching" | "game";

export interface GameView {
  you: PlayerId;
  opponent: string;
  mode: "bot" | "pvp";
  board: Board;
  turn: PlayerId;
  deadline: number | null;
  opponentConnected: boolean;
  exploding: Coord[];
  busy: boolean;
  winner: PlayerId | null;
  reason: EndReason | null;
}

interface Store {
  screen: Screen;
  username: string;
  error: string | null;
  notice: string | null;
  game: GameView | null;
  submitUsername: (name: string) => void;
  playBot: () => void;
  findMatch: () => void;
  cancelSearch: () => void;
  move: (r: number, c: number) => void;
  resign: () => void;
  backToLobby: () => void;
}

let ws: WebSocket | null = null;
let pendingName = "";
let chain: Promise<void> = Promise.resolve();
let retries = 0;

export const useStore = create<Store>()((set, get) => ({
  screen: "username",
  username: "",
  error: null,
  notice: null,
  game: null,
  submitUsername(name) {
    pendingName = name.trim();
    set({ error: null });

    connect();
  },
  playBot: () => send({ type: "play_bot" }),
  findMatch: () => send({ type: "find_match" }),
  cancelSearch: () => send({ type: "cancel_search" }),
  resign: () => send({ type: "resign" }),
  move(r, c) {
    const g = get().game;
    if (!g || g.busy || g.winner !== null || g.turn !== g.you) return;

    send({ type: "move", r, c });
  },
  backToLobby: () => set({ screen: "lobby", game: null, notice: null }),
}));

function send(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function connect(): void {
  if (ws && ws.readyState <= WebSocket.OPEN) {
    if (ws.readyState === WebSocket.OPEN && !sessionStorage.getItem("token")) {
      send({ type: "hello", username: pendingName });
    }
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    retries = 0;
    const token = sessionStorage.getItem("token");

    send(
      token
        ? { type: "hello", token }
        : { type: "hello", username: pendingName },
    );
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data) as ServerMessage;
    const at = Date.now();

    chain = chain.then(() => handle(msg, at));
  };

  ws.onclose = () => {
    ws = null;

    if (sessionStorage.getItem("token")) {
      setTimeout(connect, Math.min(1000 * 2 ** retries++, 8000));
    }
  };
}

const patchGame = (p: Partial<GameView>) =>
  useStore.setState((s) => ({ game: s.game ? { ...s.game, ...p } : s.game }));

const toDeadline = (ms: number | null, at: number) =>
  ms === null ? null : at + ms;

async function handle(msg: ServerMessage, at: number): Promise<void> {
  const { game } = useStore.getState();

  switch (msg.type) {
    case "welcome": {
      sessionStorage.setItem("token", msg.token);

      const finished = game !== null && game.winner !== null;

      useStore.setState({
        username: msg.username,
        error: null,
        screen: finished ? "game" : "lobby",
        game: finished ? game : null,
      });

      break;
    }

    case "error": {
      if (msg.code == "invalid_token") {
        sessionStorage.removeItem("token");

        useStore.setState({
          screen: "username",
          game: null,
          error: "Session expired. Pick a username again.",
        });
      } else {
        useStore.setState({ error: msg.message });
      }

      break;
    }

    case "searching": {
      useStore.setState({
        screen: "searching",
        notice: null,
        error: null,
      });

      break;
    }

    case "search_timeout": {
      useStore.setState({
        screen: "lobby",
        notice: "No player found in 30 seconds. Try again or play with a bot.",
      });

      break;
    }

    case "search_cancelled": {
      useStore.setState({
        screen: "lobby",
      });

      break;
    }

    case "game_state": {
      useStore.setState({
        screen: "game",
        notice: null,
        error: null,
        game: {
          you: msg.you,
          opponent: msg.opponent,
          mode: msg.mode,
          turn: msg.turn,
          board: msg.board,
          deadline: toDeadline(msg.turnMs, at),
          opponentConnected: msg.opponentConnected,
          exploding: [],
          busy: false,
          reason: null,
          winner: null,
        },
      });

      break;
    }

    case "move_applied": {
      useStore.setState({ notice: null });

      await animate(msg, at);

      break;
    }

    case "turn_skipped": {
      patchGame({ turn: msg.turn, deadline: toDeadline(msg.turnMs, at) });

      useStore.setState({
        notice:
          msg.player == game?.you
            ? "You missed your turn."
            : "Opponent missed their turn.",
      });

      break;
    }

    case "opponent_status": {
      patchGame({ opponentConnected: msg.connected });

      break;
    }

    case "game_over": {
      patchGame({ winner: msg.winner, reason: msg.reason, deadline: null });

      break;
    }
  }
}

async function animate(
  msg: Extract<ServerMessage, { type: "move_applied" }>,
  at: number,
) {
  const game = useStore.getState().game;
  if (!game) return;

  const board = structuredClone(game.board);

  board[msg.r][msg.c].owner = msg.by;
  board[msg.r][msg.c].count += 1;

  patchGame({ board, exploding: [], busy: true });

  await sleep(220);

  for (const wave of msg.waves) {
    patchGame({ board: wave.board, exploding: wave.exploded });

    await sleep(240);
  }

  patchGame({
    board: msg.board,
    exploding: [],
    busy: false,
    turn: msg.turn,
    deadline: toDeadline(msg.turnMs, at),
  });
}
