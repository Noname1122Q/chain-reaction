import { CONFIG } from "./config";
import { createServer } from "./server";

const server = createServer(CONFIG.port);

console.log(`Chain Reaction game server listening on port ${server.port}`);
