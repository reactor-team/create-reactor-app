"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReactor, type ReactorError } from "@reactor-team/js-sdk";

// How this app learns that the model refused a command.
//
// The model refuses a command by failing that command's own request. The
// failure carries a stable `code` to branch on (`queue_full`, `unknown_clip`)
// and a reason written for the person using the app. Only the client that
// sent the command is told, and it is told on its own call.
//
// The SDK never rejects a command call. A refused call resolves `undefined`,
// and the failure arrives on the `error` event with
// `operation: "sendCommand"` and a message of the form
// `command 'enqueue' failed (queue_full): The generation queue is full.`
// `run()` below collects that event for the span of one call and hands back
// either the reply or the refusal.
//
// A command that declares a reply (`enqueue` → `clip_queued`) resolving
// `undefined` with no failure attached is still a refusal: a model release
// that reports refusals another way resolves like that. `run()` reports it
// with a generic reason. A command with no reply (`play`, `stop`) resolves
// `undefined` on success too, so for it only the failure tells.
//
// A refusal is not a connection problem. The SDK's `lastError` mirrors every
// `error` event, refusals included, so the connection status reads
// `useSessionError()` instead, which skips command failures.

export type Refusal = { command: string; code: string; reason: string };

export type Outcome<T> =
  | { ok: true; reply: T | undefined }
  | { ok: false; refusal: Refusal };

export const GENERIC_REFUSAL = "The model refused this command.";

const COMMAND_FAILURE = /^command '([^']+)' failed \(([^)]*)\): ([\s\S]*)$/;

function refusalOf(command: string, error: ReactorError): Refusal {
  const match = COMMAND_FAILURE.exec(error.message);
  if (!match) return { command, code: error.code, reason: error.message };
  return { command, code: match[2] || error.code, reason: match[3] };
}

/** True for a failure that belongs to `command`. A failure that never reached
 *  the model (no session yet, say) carries no command name and belongs to
 *  whichever call is in flight. */
function belongsTo(command: string, error: ReactorError): boolean {
  if (error.operation !== "sendCommand") return false;
  const match = COMMAND_FAILURE.exec(error.message);
  return !match || match[1] === command;
}

type RunOptions = {
  /** False for a command whose schema declares no reply (`play`, `stop`). */
  expectsReply?: boolean;
};

type CommandValue = {
  refusal: Refusal | null;
  dismiss: () => void;
  run: <T>(
    command: string,
    call: () => Promise<T | undefined>,
    options?: RunOptions,
  ) => Promise<Outcome<T>>;
};

const CommandContext = createContext<CommandValue | null>(null);

/** Holds the latest refusal for `<CommandError />`. Mount it inside the
 *  model's provider. */
export function CommandProvider({ children }: { children: ReactNode }) {
  const reactor = useReactor((s) => s.internal.reactor);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const run = useCallback(
    async <T,>(
      command: string,
      call: () => Promise<T | undefined>,
      { expectsReply = true }: RunOptions = {},
    ): Promise<Outcome<T>> => {
      // Two concurrent calls of the same command can swap reasons, because
      // the `error` event is not tied to a call. This app sends them one at
      // a time.
      let failure: ReactorError | undefined;
      const onError = (error: ReactorError) => {
        if (belongsTo(command, error)) failure = error;
      };
      reactor.on("error", onError);
      let reply: T | undefined;
      try {
        reply = await call();
      } finally {
        reactor.off("error", onError);
      }

      if (failure || (expectsReply && reply === undefined)) {
        const refused = failure
          ? refusalOf(command, failure)
          : { command, code: "refused", reason: GENERIC_REFUSAL };
        setRefusal(refused);
        return { ok: false, refusal: refused };
      }
      setRefusal(null);
      return { ok: true, reply };
    },
    [reactor],
  );

  const dismiss = useCallback(() => setRefusal(null), []);
  const value = useMemo(
    () => ({ refusal, dismiss, run }),
    [refusal, dismiss, run],
  );
  return (
    <CommandContext.Provider value={value}>{children}</CommandContext.Provider>
  );
}

/** `run(command, call)`: send one command and read its refusal off the call.
 *  Also the latest refusal, for display. */
export function useCommand(): CommandValue {
  const value = useContext(CommandContext);
  if (!value) throw new Error("useCommand used outside CommandProvider");
  return value;
}

/** The latest failure that is not a command refusal: the token, the
 *  connection, the transport. */
export function useSessionError(): ReactorError | undefined {
  const reactor = useReactor((s) => s.internal.reactor);
  const [error, setError] = useState<ReactorError | undefined>(undefined);
  useEffect(() => {
    setError(undefined);
    const onError = (next: ReactorError) => {
      if (next.operation !== "sendCommand") setError(next);
    };
    reactor.on("error", onError);
    return () => reactor.off("error", onError);
  }, [reactor]);
  return error;
}
