"use client";

// The one import seam for the EdenLive typed SDK, @reactor-models/eden-live,
// plus the app's own names for its types and the provider's Reactor client.
import { useReactor } from "@reactor-team/js-sdk";
import type {
  EdenLiveSelectGameParams,
  EdenLiveSetSourceParams,
  EdenLiveStateUpdateMessage,
} from "@reactor-models/eden-live";

export * from "@reactor-models/eden-live";

export type Game = EdenLiveSelectGameParams["game"];
export type Source = EdenLiveSetSourceParams["source"];
export type StateUpdate = EdenLiveStateUpdateMessage;

export const GAMES = [
  "freeze",
  "spiders",
  "tracer",
  "bioshock",
  "godzilla",
  "arcadeduel",
  "dust2",
] as const satisfies readonly Game[];

// The provider's Reactor client, for its `error` event and `getLastError()`.
// A typed command resolves `undefined` when it fails or the model refuses it;
// the reason, with the model's own `code` and message, is the last error.
export function useReactorClient() {
  return useReactor((s) => s.internal.reactor);
}
