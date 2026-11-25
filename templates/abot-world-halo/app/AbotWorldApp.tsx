"use client";
import { AbotWorldHaloProvider } from "@reactor-models/abot-world-halo";
import { fetchToken } from "./lib/token";
import { WorldStateProvider } from "./lib/world";
import { Header } from "./components/Header";
import { Connection } from "./components/Connection";
import { WorldSetup } from "./components/WorldSetup";
import { WorldControls } from "./components/WorldControls";
import { WorldView } from "./components/WorldView";
import { WorldDeck } from "./components/WorldDeck";

export function AbotWorldApp() {
  return (
    <AbotWorldHaloProvider jwtToken={fetchToken}>
      <WorldStateProvider>
        <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
          <Header />
          <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row-reverse lg:gap-4 lg:p-4">
            <div className="flex min-w-0 flex-col gap-3 pb-4 lg:min-h-0 lg:flex-1 lg:pb-0">
              <WorldView />
              <div className="px-4 lg:px-0">
                <WorldDeck />
              </div>
            </div>
            <aside className="mx-4 mb-4 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 lg:m-0 lg:min-h-0 lg:w-80 lg:shrink-0 lg:overflow-y-auto">
              <Connection />
              <WorldSetup />
              <WorldControls />
            </aside>
          </main>
        </div>
      </WorldStateProvider>
    </AbotWorldHaloProvider>
  );
}
