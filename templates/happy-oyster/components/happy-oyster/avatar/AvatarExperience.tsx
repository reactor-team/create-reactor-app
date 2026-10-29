"use client";

import { useState } from "react";
import { AVATAR_PRESETS, type AvatarPreset } from "./lib/prompts";
import { HappyOysterActingProvider } from "@reactor-models/happy-oyster-acting/react";
import { ActingSession } from "./ActingSession";
import { fetchToken } from "@/lib/reactor-auth";
import { Connection } from "./Connection";
import { Character } from "./Character";
import { Performance } from "./Performance";
import { Stage } from "./Stage";
import { CommandError } from "./CommandError";

export function AvatarExperience() {
  const [preset, setPreset] = useState<AvatarPreset>(AVATAR_PRESETS[0]);
  const [setupBusy, setSetupBusy] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState(false);
  return (
    <HappyOysterActingProvider
      key="acting"
      jwtToken={fetchToken}
      connectOptions={{ autoConnect: false }}
      apiUrl={
        process.env.NEXT_PUBLIC_REACTOR_API_URL ?? "https://api.reactor.inc"
      }
    >
      <ActingSession>
        <main className="avatar-experience flex w-full min-h-0 flex-1 flex-col gap-4 p-4 max-lg:overflow-y-auto sm:p-6 lg:flex-row lg:gap-6">
          <aside className="order-2 flex w-full flex-col gap-4 lg:order-1 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:pr-1">
            <Connection
              setupBusy={setupBusy}
              onBusyChange={setConnectionBusy}
            />
            <CommandError />
            <Character
              preset={preset}
              onPresetChange={setPreset}
              connectionBusy={connectionBusy}
              onBusyChange={setSetupBusy}
            />
            <Performance setupBusy={setupBusy} />
          </aside>
          <Stage />
        </main>
      </ActingSession>
    </HappyOysterActingProvider>
  );
}
