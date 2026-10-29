"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  useHappyOysterActing,
  useHappyOysterActingSessionState,
  useHappyOysterActingCommandError,
} from "@reactor-models/happy-oyster-acting/react";
import {
  createSessionView,
  type ActingApi,
  type ActingView,
} from "./lib/session-view";

type Session = ActingApi &
  ActingView &
  Pick<ReturnType<typeof createSessionView>, "getSnapshot" | "subscribe">;
const Context = createContext<Session | null>(null);

export function ActingSession({ children }: { children: ReactNode }) {
  const api = useHappyOysterActing();
  const current = useRef(api);
  current.current = api;
  const [view] = useState(createSessionView);
  const snapshot = useSyncExternalStore(
    view.subscribe,
    view.getSnapshot,
    view.getSnapshot
  );
  useEffect(() => {
    view.connection({
      status: api.status,
      sessionId: api.sessionId,
      lastError: api.lastError,
    });
  }, [api.status, api.sessionId, api.lastError, view]);
  useEffect(() => () => view.reset(), [view]);
  useHappyOysterActingSessionState((message) => view.sessionState(message));
  useHappyOysterActingCommandError((message) => view.commandError(message));

  const session: Session = {
    ...api,
    ...snapshot,
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    connect: async (...args) => {
      view.beginConnect();
      await current.current.connect(...args);
    },
    disconnect: async (...args) => {
      view.beginDisconnect();
      await current.current.disconnect(...args);
    },
    getState: async () => {
      const before = view.getSnapshot();
      if (before.status !== "ready") return undefined;
      const reply = await current.current.getState();
      if (view.getSnapshot().epoch !== before.epoch) return undefined;
      // A newer broadcast wins over an older correlated snapshot.
      if (reply && view.getSnapshot() === before)
        view.sessionState(reply, before.epoch);
      return reply;
    },
    endPerformance: async () => {
      const before = view.getSnapshot();
      const reply = await current.current.endPerformance();
      return view.getSnapshot().epoch === before.epoch ? reply : undefined;
    },
  };
  return <Context.Provider value={session}>{children}</Context.Provider>;
}

export function useActingSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Acting controls require ActingSession.");
  return session;
}
