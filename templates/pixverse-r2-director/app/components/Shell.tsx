"use client";

import type { ReactNode } from "react";
import { Header } from "./Header";

// The page frame. On a desktop the stage fills the right and the sidebar
// scrolls on the left; the page itself never scrolls. On a
// phone the stage is pinned on top so the model's output stays visible while
// the controls scroll beneath it, and the mobile padding lives on the
// children, not <main>, so the stage sits flush against the viewport edge
// with a solid backdrop.
export function Shell({ stage, sidebar }: { stage: ReactNode; sidebar: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <Header />
      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row-reverse lg:gap-6 lg:p-6">
        <section className="flex flex-col gap-3 max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:bg-zinc-950/95 max-lg:p-4 max-lg:pb-3 max-lg:backdrop-blur-sm lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-hidden">
          {stage}
        </section>
        <aside className="flex w-full flex-col gap-4 p-4 pt-1 lg:w-80 lg:shrink-0 lg:min-h-0 lg:overflow-y-auto lg:p-0">
          {sidebar}
        </aside>
      </main>
    </div>
  );
}
