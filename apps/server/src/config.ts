export const CONFIG = {
  port: Number(process.env.PORT ?? 3001),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),
  matchmakingTimeoutMs: 30000,
  turnTimeoutMs: 60000,
  maxMissedTurns: 2,
  reconnectGraceMs: 30000,
  reapAfterMs: 35000,
  helloTimeoutMs: 10000,
  maxMessageBytes: 512,
  maxConnectionsPerIP: 5,
  rateCapacity: 10,
  rateRefillPerSec: 5,
  botDelayMs: 800,
};
