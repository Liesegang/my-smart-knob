import "./build.mjs";
import { createServer } from "node:http";
import { createRequestHandler } from "./server.mjs";

const port = Number(process.env.PORT || 4173);
createServer(createRequestHandler()).listen(port, "127.0.0.1", () =>
  console.log(`SmartKnob Demo: http://127.0.0.1:${port}`),
);
