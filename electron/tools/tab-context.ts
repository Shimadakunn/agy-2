import { AsyncLocalStorage } from "node:async_hooks";

/** Flows the current chat tab ID through async tool calls */
export const chatTabContext = new AsyncLocalStorage<string>();
