const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const RESERVED = new Set(["bot", "admin", "system", "server"]);

export function cleanUsername(raw: string | undefined): string | null {
  const name = (raw ?? "").trim();

  if (!USERNAME.test(name)) return null;
  if (RESERVED.has(name.toLowerCase())) return null;

  return name;
}
