"use client";
import { useEffect, useRef, useState } from "react";
import type { HappyOysterActingPerformanceEndedMessage } from "@reactor-models/happy-oyster-acting/core";
import { useActingSession } from "./ActingSession";

export function Performance({ setupBusy = false }: { setupBusy?: boolean }) {
  const model = useActingSession();
  const { status, sessionId, sessionState: snapshot } = model;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] =
    useState<HappyOysterActingPerformanceEndedMessage | null>(null);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    if (status !== "ready") {
      setBusy(null);
      setError(null);
      setEnded(null);
      setCopied(false);
    } else {
      const generation = epoch.current;
      void model.getState().catch((cause) => {
        if (epoch.current === generation)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    } // ActingSession applies the awaited reply only in the originating epoch.
  }, [status, sessionId]);
  const currentCharacter = useRef(snapshot?.character_id);
  currentCharacter.current = snapshot?.character_id;
  useEffect(() => {
    setCopied(false);
  }, [snapshot?.character_id]);
  if (status !== "ready" || !snapshot) return null;
  const phase = snapshot.phase;
  const canStart =
    ["ready", "ended", "failed"].includes(phase) &&
    snapshot.character_status === "ready";
  const canInstruct = ["live", "paused"].includes(phase);
  async function run(name: string, command: () => Promise<unknown>) {
    const generation = epoch.current;
    setBusy(name);
    setError(null);
    try {
      await command();
    } catch (e) {
      if (epoch.current === generation)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (epoch.current === generation) setBusy(null);
    }
  }
  async function copyCharacter() {
    const characterId = snapshot?.character_id;
    if (!characterId) return;
    const generation = epoch.current;
    try {
      await navigator.clipboard.writeText(characterId);
      if (
        epoch.current === generation &&
        currentCharacter.current === characterId
      )
        setCopied(true);
    } catch {
      if (
        epoch.current === generation &&
        currentCharacter.current === characterId
      )
        setError(
          "Could not copy the character ID. Select the ID above and copy it manually."
        );
    }
  }
  return (
    <section className="panel space-y-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Performance</span>
        <strong className="text-sm" role="status">
          {phase}
        </strong>
      </div>
      {snapshot.character_id && (
        <div>
          <p className="text-sm">
            {snapshot.character_name ?? "Your character"}
          </p>
          <details className="muted mt-2">
            <summary className="cursor-pointer">Character ID</summary>
            <p className="break-all select-all">{snapshot.character_id}</p>
            <button className="button mt-2" onClick={copyCharacter}>
              {copied ? "Copied character ID" : "Copy character ID"}
            </button>
          </details>
        </div>
      )}
      {canStart && !setupBusy && (
        <button
          className="button primary w-full"
          disabled={!!busy}
          onClick={() =>
            run("start", async () => {
              setEnded(null);
              await model.startPerformance();
            })
          }
        >
          {phase === "ended" || phase === "failed"
            ? "Start again"
            : "Start performance"}
        </button>
      )}
      {phase === "building" && !setupBusy && (
        <p className="muted">Creating character…</p>
      )}
      {phase === "live" && (snapshot.last_frame_age_ms ?? 0) > 4000 && (
        <p className="muted" role="status">
          Waiting for video · last frame{" "}
          {Math.round((snapshot.last_frame_age_ms ?? 0) / 1000)}s ago
        </p>
      )}
      {phase === "starting" && (
        <p className="muted">
          Starting the performance. Waiting for the first video frame…
        </p>
      )}
      {phase === "ending" && (
        <p className="muted">
          The performance is stopping and media is being released. Wait for
          ended before starting again.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {phase === "live" && (
          <button
            className="button"
            disabled={!!busy}
            onClick={() => run("pause", model.pause)}
          >
            Pause
          </button>
        )}
        {phase === "paused" && (
          <button
            className="button primary"
            disabled={!!busy}
            onClick={() => run("resume", model.resume)}
          >
            Resume
          </button>
        )}
        {["starting", "live", "paused"].includes(phase) && (
          <button
            className="button"
            disabled={!!busy}
            onClick={() =>
              run("end", async () => {
                const generation = epoch.current;
                const reply = await model.endPerformance();
                if (reply && epoch.current === generation) setEnded(reply);
              })
            }
          >
            End performance
          </button>
        )}
      </div>
      {canInstruct && (
        <div className="space-y-3">
          <label className="block text-xs">
            What happens next?
            <textarea
              className="field min-h-24"
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="They smile, lean forward, and say…"
            />
          </label>
          <button
            className="button primary w-full"
            disabled={!!busy || !text.trim()}
            onClick={() =>
              run("instruct", () => model.instruct({ text: text.trim() }))
            }
          >
            {phase === "paused"
              ? "Send direction while paused"
              : "Send direction"}
          </button>
          <p className="muted">
            Directions appear below when accepted. A refused direction leaves
            the performance running.
          </p>
        </div>
      )}
      {Array.isArray(snapshot.instructions) &&
        snapshot.instructions.length > 0 && (
          <ol className="max-h-60 space-y-3 overflow-y-auto border-t border-border pt-3">
            {snapshot.instructions.map((item, index) => {
              if (!item || typeof item !== "object") return null;
              const entry = item as Record<string, unknown>;
              return (
                <li key={index} className="text-xs">
                  <span className="eyebrow">
                    {String(entry.status ?? "unknown")}
                  </span>
                  <p className="mt-1">{String(entry.text ?? "")}</p>
                </li>
              );
            })}
          </ol>
        )}
      {snapshot.end_reason && (
        <p className="muted">Ended: {snapshot.end_reason}</p>
      )}
      {ended && (
        <p className="muted">
          End reply: {ended.end_reason} · {ended.duration_seconds}s reported
          duration
        </p>
      )}
      {snapshot.performance_elapsed_seconds != null && (
        <p className="muted">
          {snapshot.performance_elapsed_seconds}s elapsed, including pauses.
          Limit: about {snapshot.performance_max_seconds}s of active
          performance.
        </p>
      )}
      <button
        className="button"
        disabled={!!busy}
        onClick={() =>
          run("refresh", async () => {
            await model.getState();
          })
        }
      >
        Refresh state
      </button>
      {busy && (
        <p className="muted" role="status">
          Waiting for {busy}…
        </p>
      )}
      {error && (
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
