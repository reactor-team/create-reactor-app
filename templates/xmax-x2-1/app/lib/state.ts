import type { XmaxX21StateUpdateMessage } from "@reactor-models/xmax-x2-1";
import type { XmaxX21UiState } from "./types";

// Projects model `state_update` snapshots into XmaxX21UiState. Returns the
// previous object when nothing changed so React can bail out of re-rendering
// the whole tree on the model's frequent identical echoes. The drag pointer
// is intentionally absent: it rides the same snapshot but changes every frame
// of a drag, so it lives outside this reducer (see PointerPanel) — that keeps
// the bail-out effective through a drag, when only the pointer is moving.
//
// referenceAccepted is the one field the snapshot doesn't carry (it comes
// from the discrete reference_image_accepted ack), so it passes through
// unchanged — except when the snapshot reports no reference, which drops the
// stale dimensions.
export function reduce(
  state: XmaxX21UiState,
  msg: XmaxX21StateUpdateMessage
): XmaxX21UiState {
  const next: XmaxX21UiState = {
    generating: msg.generating,
    activePrompt: msg.prompt,
    outputWidth: msg.width,
    outputHeight: msg.height,
    hasReference: msg.has_reference_image,
    referenceAccepted: msg.has_reference_image ? state.referenceAccepted : null,
  };
  const changed = (Object.keys(next) as (keyof XmaxX21UiState)[]).some(
    (k) => next[k] !== state[k]
  );
  return changed ? next : state;
}
