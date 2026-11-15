import { useEffect, useState } from "react";
import { useStore } from "../store";

export function UsernameScreen() {
  const [name, setName] = useState("");
  const submit = useStore((s) => s.submitUsername);
  const error = useStore((s) => s.error);
  const valid = /^[A-Za-z0-9_]{3,16}$/.test(name.trim());

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) submit(name);
      }}
    >
      <label htmlFor="username">Choose a username</label>
      <input
        id="username"
        value={name}
        maxLength={16}
        autoFocus
        autoComplete="off"
        placeholder="3-16 letters, numbers or _"
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button disabled={!valid}>Continue</button>
    </form>
  );
}

export function Lobby() {
  const username = useStore((s) => s.username);
  const notice = useStore((s) => s.notice);
  const error = useStore((s) => s.error);
  const playBot = useStore((s) => s.playBot);
  const findMatch = useStore((s) => s.findMatch);

  return (
    <section className="card">
      <p>
        Hi, <strong>{username}</strong>. Pick a mode:
      </p>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <button onClick={playBot}>Play vs Bot</button>
      <button onClick={findMatch}>Find a player</button>
    </section>
  );
}

export function Searching() {
  const cancel = useStore((s) => s.cancelSearch);
  const [left, setLeft] = useState(30);

  useEffect(() => {
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="card">
      <p>Looking for an opponent... {left}s</p>
      <button className="secondary" onClick={cancel}>
        Cancel
      </button>
    </section>
  );
}
