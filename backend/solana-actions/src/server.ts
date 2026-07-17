import { Connection } from "@solana/web3.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const connection = new Connection(config.rpcUrl, "confirmed");
const app = createApp(config, connection);

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Arena90 Solana Actions listening on 127.0.0.1:${config.port}`);
});
