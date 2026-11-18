"use client";

// PIXVERSE R2 PERSONA — REFERENCE FRONTEND
//
// Persona turns one portrait into a character you talk to in real time. It
// speaks on `main_video` and `main_audio` and listens on the `mic` track and
// through `say`; every sentence it speaks also arrives as a `transcript`.
//
// The typed client is @reactor-models/pixverse-r2-persona. It bakes the model name and tracks into the
// provider and exposes typed commands and per-message hooks:
//
//   <PixverseR2PersonaProvider jwtToken={…} />    — session lifecycle
//   usePixverseR2Persona()                        — status + typed commands
//   createCharacter / startCall / say / endCall   — model commands
//   usePixverseR2PersonaTranscript((m) => …)      — subtitles
//   <PixverseR2PersonaMainVideoView />            — the character
//
// The flow itself (connect → mic → create_character → start_call → talk)
// lives in app/lib/session.tsx; the components only read from it.
import { CommandError } from "@/app/components/CommandError";
import { CharacterSetup } from "@/app/components/CharacterSetup";
import { Conversation } from "@/app/components/Conversation";
import { PersonaStage } from "@/app/components/PersonaStage";
import { SavedClipsProvider } from "@/app/components/SavedClips";
import { Shell } from "@/app/components/Shell";
import { StatusBadge } from "@/app/components/StatusBadge";
import { ToastProvider } from "@/app/components/Toasts";
import { inCall, PersonaSessionProvider, usePersona } from "@/app/lib/session";
import { PixverseR2PersonaProvider } from "@reactor-models/pixverse-r2-persona";
import { resolveToken } from "@/app/lib/token";

// No `autoConnect`: the session connects when you press Call (or Connect in
// the status panel), so the connection lifecycle is visible.
export function PersonaApp() {
  return (
    <ToastProvider>
      <PixverseR2PersonaProvider jwtToken={resolveToken}>
        <SavedClipsProvider>
          <PersonaSessionProvider>
            <Shell
              stage={<PersonaStage />}
              sidebar={
                <>
                  <StatusBadge />
                  <CommandError />
                  <Sidebar />
                </>
              }
            />
          </PersonaSessionProvider>
        </SavedClipsProvider>
      </PixverseR2PersonaProvider>
    </ToastProvider>
  );
}

function Sidebar() {
  const { snapshot } = usePersona();
  return inCall(snapshot?.phase) ? <Conversation /> : <CharacterSetup />;
}
