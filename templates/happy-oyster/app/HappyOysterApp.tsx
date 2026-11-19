"use client";

// The fixed shell: header on top, control sidebar beside the content screen —
// the layout every Reactor example uses, and it never changes shape. Nothing
// here navigates or goes full screen: useWorldSession() reduces the SDK's
// authoritative snapshot to one AppView (lib/view.ts) and the two regions
// switch what they show off it, so the page always mirrors the session's
// state machine.
//
// The experience mode is fixed for the life of a session (each mode is its own
// Reactor model), so the pending intent — and the mode it implies — is owned
// here, above the provider, and the provider is keyed on the mode: picking a
// world of the other experience remounts a fresh session. Nothing connects
// until you hit Connect or pick a world.

import { useCallback, useState } from "react";
import type { HappyOysterMode } from "@reactor-models/happy-oyster";
import type { WorldIntent } from "@/lib/worlds";
import { Header } from "@/components/Header";
import { LiveClientProvider } from "@/components/happy-oyster/ho-client";
import { useWorldSession } from "@/components/happy-oyster/use-world-session";
import { Sidebar } from "@/components/happy-oyster/Sidebar";
import { AvatarExperience } from "@/components/happy-oyster/avatar/AvatarExperience";
import { Screen } from "@/components/happy-oyster/Screen";

export function HappyOysterApp() {
  const [mode, setMode] = useState<HappyOysterMode | "avatar">("adventure");
  const [intent, setIntent] = useState<WorldIntent | null>(null);

  // A new intent sets both the mode (which model to connect to) and the intent.
  // Leaving an intent keeps the mode, so returning to the same experience
  // reuses the session instead of remounting it.
  const run = useCallback((next: WorldIntent) => {
    setMode(next.mode);
    setIntent(next);
  }, []);
  const clearIntent = useCallback(() => setIntent(null), []);

  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <Header />
      <nav
        aria-label="Happy Oyster experience"
        className="flex shrink-0 gap-2 border-b border-zinc-800 px-4 py-3 sm:px-6"
      >
        {(["adventure", "directing", "avatar"] as const).map((experience) => (
          <button
            key={experience}
            aria-pressed={mode === experience}
            disabled={
              experience === "avatar" &&
              process.env.NEXT_PUBLIC_HO_LOCAL_RUNTIME === "1"
            }
            onClick={() => {
              if (mode === experience) return;
              setIntent(null);
              setMode(experience);
            }}
            className={`rounded-md px-4 py-2 text-sm capitalize transition disabled:opacity-40 ${mode === experience ? "bg-primary text-primary-foreground" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`}
          >
            {experience === "avatar" ? "Acting" : experience}
          </button>
        ))}
      </nav>
      {mode === "avatar" ? (
        <AvatarExperience />
      ) : (
        <LiveClientProvider mode={mode} key={mode}>
          <Shell
            mode={mode}
            intent={intent}
            onRun={run}
            onClearIntent={clearIntent}
          />
        </LiveClientProvider>
      )}
    </div>
  );
}

function Shell({
  mode,
  intent,
  onRun,
  onClearIntent,
}: {
  mode: HappyOysterMode;
  intent: WorldIntent | null;
  onRun: (intent: WorldIntent) => void;
  onClearIntent: () => void;
}) {
  const session = useWorldSession({ intent, onRun, onClearIntent });
  return (
    <main className="flex w-full min-h-0 flex-1 flex-col gap-4 p-4 max-lg:overflow-y-auto sm:p-6 lg:flex-row lg:gap-6">
      <Sidebar session={session} mode={mode} />
      <Screen session={session} />
    </main>
  );
}
