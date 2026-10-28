"use client";

// XMAX X2.1 — REFERENCE FRONTEND
//
// XmaxX21 is a real-time streaming video-to-video editing model: it edits
// whatever arrives on the `source` track, live, steered by a text
// prompt you can swap mid-stream, an optional reference image, and a
// drag-to-steer pointer on the output.
//
// The typed client comes from the `@reactor-models/xmax-x2-1`
// package. It bakes the model name and tracks into <XmaxX21Provider> and
// exposes typed commands and per-message hooks, so the app reads the
// same as the sibling templates:
//
//   <XmaxX21Provider jwtToken={fetchToken} />     — session lifecycle
//   useXmaxX21()                                  — status + typed commands
//   setPrompt({ prompt })                    — model commands
//   useXmaxX21StateUpdate((msg) => …)             — model → client messages
//   <XmaxX21MainVideoView />                      — the live output
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  XmaxX21Provider,
  useXmaxX21,
  useXmaxX21GenerationStopped,
  useXmaxX21StateUpdate,
} from "@reactor-models/xmax-x2-1";
import {
  DEFAULT_UI_STATE,
  type XmaxX21SourceMode,
  type XmaxX21UiState,
} from "@/app/lib/types";
import { reduce } from "@/app/lib/state";
import { Header } from "./components/Header";
import { StatusBadge } from "./components/StatusBadge";
import { SourcePanel } from "./components/SourcePanel";
import { ReferenceImage } from "./components/ReferenceImage";
import { PointerPanel } from "./components/PointerPanel";
import { Prompt } from "./components/Prompt";
import { Stage } from "./components/Stage";
import { useSourcePublisher } from "./components/useSourcePublisher";
import { REACTOR_API_URL } from "@/app/lib/config";
import {
  diagnosticReducer,
  INITIAL_DIAGNOSTICS,
  type DiagnosticReporter,
} from "@/app/lib/errors";

// JWT resolver passed to <XmaxX21Provider jwtToken>. js-sdk 3.x accepts a static
// string or a resolver; the SDK calls a resolver on every Reactor API request,
// which is what keeps uploads, clip manifests and ICE refreshes from 401ing
// once the token ages out.
//
// The token is memoized here, in module scope, until shortly before it expires,
// and the fetch is no-store so the browser HTTP cache stays out of it. A token
// is session-scoped: it may only operate the sessions it created, so every hop
// of a session has to present the same JWT. If a cache miss let the resolver
// mint a fresh token mid-session, the next upload or clip call would 403.
const TOKEN_REFRESH_SKEW_MS = 60_000;
let cachedToken: { jwt: string; expiresAtMs: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  if (
    cachedToken &&
    Date.now() < cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS
  ) {
    return cachedToken.jwt;
  }
  // Coalesce the parallel hops the SDK fires at connect time into one mint.
  if (inflightToken) return inflightToken;
  inflightToken = (async () => {
    try {
      const r = await fetch("/api/reactor/token", { cache: "no-store" });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Token fetch failed: ${r.status}`);
      }
      const { jwt, expires_at } = (await r.json()) as {
        jwt: string;
        expires_at: number;
      };
      cachedToken = { jwt, expiresAtMs: expires_at * 1000 };
      return jwt;
    } finally {
      inflightToken = null;
    }
  })();
  return inflightToken;
}

// No `autoConnect`: the user clicks Connect so they see the
// disconnected -> connecting -> waiting -> ready state machine first-hand.
export function XmaxX21App() {
  return (
    <XmaxX21Provider
      apiUrl={REACTOR_API_URL}
      jwtToken={fetchToken}
      connectOptions={{ autoConnect: false }}
    >
      <Workspace />
    </XmaxX21Provider>
  );
}

function Workspace() {
  const { status, lastError, sessionId } = useXmaxX21();
  const [diagnostics, dispatchDiagnostic] = useReducer(
    diagnosticReducer,
    INITIAL_DIAGNOSTICS
  );
  const lastSessionRef = useRef<string | undefined>(undefined);
  if (sessionId) lastSessionRef.current = sessionId;
  const recordedErrors = useRef(new WeakSet<object>());
  const reportError = useCallback<DiagnosticReporter>((error, operation) => {
    if (error && typeof error === "object") {
      if (recordedErrors.current.has(error)) return;
      recordedErrors.current.add(error);
    }
    dispatchDiagnostic({
      type: "error",
      error,
      operation,
      sessionId: lastSessionRef.current,
      at: Date.now(),
    });
  }, []);
  useEffect(() => {
    dispatchDiagnostic({ type: "session", sessionId });
  }, [sessionId]);
  useEffect(() => {
    if (lastError) reportError(lastError, "sdk");
  }, [lastError, reportError]);

  const [ui, setUi] = useState<XmaxX21UiState>(DEFAULT_UI_STATE);
  // Webcam is the default source; "video" streams a pre-recorded clip and
  // "image" repeats a still image as a constant feed (drag-to-animate). All
  // three feed the same `source` track.
  const [mode, setMode] = useState<XmaxX21SourceMode>("webcam");

  // Whichever source is active (webcam self-view in the panel, playing clip
  // or repeated canvas frame in the stage) produces a track and hands it
  // here; useSourcePublisher is the single owner of the `source` slot and
  // reconciles the wire to the latest track, so mode switches can't race
  // two publishers.
  const [sourceTrack, setSourceTrack] = useState<MediaStreamTrack | null>(null);
  const sourceReady = useSourcePublisher(sourceTrack, reportError);
  const [referenceBusy, setReferenceBusy] = useState(false);

  // URLs of the media selected in "video" / "image" mode (object URL for a
  // local file, or a preset's path). Owned here so the stage's input pane can
  // stream them; the setters revoke a replaced object URL.
  const [videoUrl, setVideoUrlState] = useState<string | null>(null);
  const setVideoUrl = (url: string | null) =>
    setVideoUrlState((prev) => {
      if (prev && prev !== url && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith("blob:"))
        URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const [imageUrl, setImageUrlState] = useState<string | null>(null);
  const setImageUrl = (url: string | null) =>
    setImageUrlState((prev) => {
      if (prev && prev !== url && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith("blob:"))
        URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Bumped on a user reset and used as a React key on children that hold
  // local draft state (prompt draft, reference preview), remounting them in
  // step with the model's reset — which clears prompt, reference image, and
  // pointer server-side.
  const [resetNonce, setResetNonce] = useState(0);

  // While generation is stopped, black out the stage (the WebRTC view would
  // otherwise freeze on the last transformed frame). Lifts when generation
  // runs again.
  const [stageCleared, setStageCleared] = useState(false);

  // The model's snapshot is the source of truth: only the typed
  // `state_update` message feeds the reducer (see lib/state.ts).
  useXmaxX21StateUpdate((msg) => {
    if (msg.generating) setStageCleared(false);
    setUi((s) => reduce(s, msg));
  });

  useXmaxX21GenerationStopped((msg) => {
    setStageCleared(true);
    // Reference swaps keep running; only reset stops generation and clears drafts.
    if (msg.reason === "reset") setResetNonce((n) => n + 1);
  });

  // Reset local state on full disconnect so a reconnect starts clean.
  useEffect(() => {
    if (status === "disconnected") {
      setUi(DEFAULT_UI_STATE);
      setResetNonce((value) => value + 1);
      setVideoUrl(null);
      setImageUrl(null);
      setStageCleared(false);
    }
  }, [status]);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <Header />
      {/* The stage comes first in the DOM: on mobile it is pinned (sticky)
          on top so the model output stays visible while the controls scroll
          beneath it, and the mobile padding lives on the children, not
          <main>, so it can sit flush against the viewport edge with a solid
          backdrop. lg:flex-row-reverse restores the desktop sidebar-left /
          stage-right split. */}
      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row-reverse lg:gap-6 lg:p-6">
        <section className="flex flex-col gap-4 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:bg-zinc-950/95 max-lg:p-4 max-lg:pb-3 max-lg:backdrop-blur-sm lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-hidden">
          <Stage
            ui={ui}
            mode={mode}
            videoUrl={videoUrl}
            imageUrl={imageUrl}
            cleared={stageCleared}
            sourceTrack={sourceTrack}
            onTrack={setSourceTrack}
          />
        </section>
        <aside className="flex w-full flex-col gap-4 p-4 pt-1 lg:w-80 lg:shrink-0 lg:min-h-0 lg:overflow-y-auto lg:p-0">
          <StatusBadge
            errors={diagnostics.entries}
            sessionId={diagnostics.sessionId}
            onError={reportError}
            onClear={() => dispatchDiagnostic({ type: "clear" })}
          />
          <SourcePanel
            generating={ui.generating}
            mode={mode}
            onModeChange={setMode}
            onSelectVideo={(url) => setVideoUrl(url)}
            onSelectImage={(url) => setImageUrl(url)}
            onTrack={setSourceTrack}
          />
          <ReferenceImage
            onError={reportError}
            onBusyChange={setReferenceBusy}
            key={`r${resetNonce}`}
            generating={ui.generating}
            hasReference={ui.hasReference}
            accepted={ui.referenceAccepted}
            onAccepted={(size) =>
              setUi((s) => ({
                ...s,
                hasReference: true,
                referenceAccepted: size,
              }))
            }
          />
          <PointerPanel />
          <Prompt
            key={`p${resetNonce}`}
            activePrompt={ui.activePrompt}
            sourceReady={sourceReady}
            referenceBusy={referenceBusy}
            referenceReady={ui.hasReference && ui.referenceAccepted !== null}
            onError={reportError}
          />
        </aside>
      </main>
    </div>
  );
}
