"use client";

// The one import seam for the EdenLive typed SDK, @reactor-models/eden-live,
// plus the app's own names for its types and the provider's Reactor client.
import { useReactor, type ReactorError } from "@reactor-team/js-sdk";
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

// The provider's Reactor client, for its `error` event.
export function useReactorClient() {
  return useReactor((s) => s.internal.reactor);
}

type ErrorSource = {
  on(event: "error", handler: (error: ReactorError) => void): void;
  off(event: "error", handler: (error: ReactorError) => void): void;
};

// A typed command resolves `undefined` when it fails or the model refuses it.
// The reason arrives on the `error` event as
// `command '<name>' failed (<code>): <message>`, so collect it for this call
// only; `getLastError()` is client-wide and can hold an older failure.
export async function sendCommand<T>(
  reactor: ErrorSource,
  name: string,
  call: () => Promise<T | undefined>
): Promise<T> {
  let failure: ReactorError | undefined;
  const onError = (error: ReactorError) => {
    if (
      error.operation === "sendCommand" &&
      error.message.includes(`'${name}'`)
    )
      failure = error;
  };
  reactor.on("error", onError);
  let reply: T | undefined;
  try {
    reply = await call();
  } finally {
    reactor.off("error", onError);
  }
  if (reply === undefined || failure)
    throw new Error(failure?.message ?? `${name} was not accepted.`);
  return reply;
}
