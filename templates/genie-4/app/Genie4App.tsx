"use client";
import { Genie4Provider } from "@reactor-models/genie-4";
import { fetchToken } from "./lib/token";
import { Header } from "./components/Header";
import { Connection } from "./components/Connection";
import { WorldStarter } from "./components/WorldStarter";
import { WorldControls } from "./components/WorldControls";
import { WorldView } from "./components/WorldView";
import { SnapClip } from "./components/SnapClip";
export function Genie4App() {
  return (
    <Genie4Provider jwtToken={fetchToken}>
      <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
        <Header />
        <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row-reverse lg:gap-4 lg:p-4">
          <WorldView />
          <aside className="mx-4 mb-4 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 lg:m-0 lg:min-h-0 lg:w-80 lg:shrink-0 lg:overflow-y-auto">
            <Connection />
            <WorldStarter />
            <WorldControls />
            <SnapClip getJwt={fetchToken} />
          </aside>
        </main>
      </div>
    </Genie4Provider>
  );
}
