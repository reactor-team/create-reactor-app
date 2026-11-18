"use client";

// PIXVERSE R2 DIRECTOR — REFERENCE FRONTEND
//
// Director builds a world from a description and reference images, then
// films it scene by scene: each prompt you queue becomes a 5 to 10 s clip
// that continues from the last frame of the one before. The clips have no sound.
//
// The typed client is @reactor-models/pixverse-r2-director. It bakes the model name and tracks into the
// provider and exposes typed commands and per-message hooks:
//
//   <PixverseR2DirectorProvider jwtToken={…} />   — session lifecycle
//   usePixverseR2Director()                       — status + typed commands
//   createWorld / enqueue / play / stop / pop …   — model commands
//   usePixverseR2DirectorSessionState((m) => …)   — the state snapshot
//   <PixverseR2DirectorMainVideoView />           — the output
//
// The flow itself (connect → create_world → enqueue → autoplay) lives in
// app/lib/session.tsx; the components only read from it.
import { CommandError } from "@/app/components/CommandError";
import { DirectorStage } from "@/app/components/DirectorStage";
import { SceneComposer } from "@/app/components/SceneComposer";
import { SceneReel } from "@/app/components/SceneReel";
import { WorldSetup } from "@/app/components/WorldSetup";
import { SavedClipsProvider } from "@/app/components/SavedClips";
import { Shell } from "@/app/components/Shell";
import { StatusBadge } from "@/app/components/StatusBadge";
import { ToastProvider } from "@/app/components/Toasts";
import { DirectorSessionProvider, useDirector } from "@/app/lib/session";
import { PixverseR2DirectorProvider } from "@reactor-models/pixverse-r2-director";
import { resolveToken } from "@/app/lib/token";

// No `autoConnect`: the session connects when you press the primary button
// (or Connect in the status panel), so the disconnected → connecting →
// waiting → ready lifecycle is visible.
export function DirectorApp() {
  return (
    <ToastProvider>
      <PixverseR2DirectorProvider jwtToken={resolveToken}>
        <SavedClipsProvider>
          <DirectorSessionProvider>
            <Shell
              stage={<DirectorStage />}
              sidebar={
                <>
                  <StatusBadge />
                  <CommandError />
                  <div className="lg:hidden">
                    <SceneReel />
                  </div>
                  <Sidebar />
                </>
              }
            />
          </DirectorSessionProvider>
        </SavedClipsProvider>
      </PixverseR2DirectorProvider>
    </ToastProvider>
  );
}

function Sidebar() {
  const { settingUp } = useDirector();
  return settingUp ? <WorldSetup /> : <SceneComposer />;
}
