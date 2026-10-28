"use client";

import { useXmaxX21 } from "@reactor-models/xmax-x2-1";
import type { XmaxX21SourceMode } from "@/app/lib/types";
import { Button, Panel, SegmentedToggle } from "./ui";
import { ImagePicker } from "./ImagePicker";
import { VideoPicker } from "./VideoPicker";
import { WebcamSource } from "./WebcamSource";

// The Source panel. XmaxX21 has no explicit start command: generation begins on
// its own once a prompt (including an empty string) is set AND source frames are arriving, so
// this panel only picks what streams into the `source` track.
//
// Every mode only *produces* a MediaStreamTrack; the controller's
// useSourcePublisher is the single owner of the `source` slot, so mode
// switches swap tracks on one publisher instead of racing two.
//
//   - Webcam mode renders the self-view here (WebcamSource) and hands its
//     track up via onTrack. It stays mounted across the start transition
//     so the camera keeps streaming while generation runs.
//   - Video and image modes only pick media here; the stage plays/repeats
//     it and hands the captured track up the same way. Image mode streams
//     a still image as a constant feed — the drag-to-animate setup: prompt
//     it, then steer the subject with the pointer.
//   - Generating: the source is fixed for the run — Reset stops generation
//     (and clears prompt, reference image, and pointer) to change it.
export function SourcePanel({
  generating,
  mode,
  onModeChange,
  onSelectVideo,
  onSelectImage,
  onTrack,
}: {
  generating: boolean;
  mode: XmaxX21SourceMode;
  onModeChange: (m: XmaxX21SourceMode) => void;
  onSelectVideo: (url: string, name: string) => void;
  onSelectImage: (url: string, name: string) => void;
  onTrack: (track: MediaStreamTrack | null) => void;
}) {
  const { reset, status } = useXmaxX21();
  const ready = status === "ready";

  const handleModeChange = (m: XmaxX21SourceMode) => {
    if (generating) return; // source is fixed once a run has started — reset to switch
    onModeChange(m);
  };

  return (
    <Panel label="Source">
      {!generating && (
        <SegmentedToggle
          aria-label="Input source"
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: "webcam", label: "Webcam" },
            { value: "video", label: "Video" },
            { value: "image", label: "Image" },
          ]}
        />
      )}

      {mode === "webcam" ? (
        <div className={generating ? "" : "mt-3"}>
          {ready ? (
            <WebcamSource onTrack={onTrack} />
          ) : (
            <p className="text-xs text-zinc-500">
              Connect to enable the camera.
            </p>
          )}
        </div>
      ) : mode === "video" ? (
        !generating && (
          <div className="mt-3">
            <VideoPicker onSelect={onSelectVideo} />
          </div>
        )
      ) : (
        !generating && (
          <div className="mt-3">
            <ImagePicker onSelect={onSelectImage} />
          </div>
        )
      )}

      {generating ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!ready}
            onClick={() => reset()}
          >
            Reset
          </Button>
          <span className="text-xs text-zinc-500">
            Editing — reset to change the source
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          {ready
            ? "Generation starts once a prompt is set and frames are streaming."
            : "Connect, then set a prompt to start."}
        </p>
      )}
    </Panel>
  );
}
