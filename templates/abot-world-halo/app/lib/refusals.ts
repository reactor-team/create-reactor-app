// Readable text for every refusal code ABot World Halo can return
// (model_behaviour.md). A refusal fails the call only: nothing else changes.
const REFUSALS: Record<string, string> = {
  locked_while_running:
    "The first frame, characters, seed and resolution are fixed while a world runs. Reset to change them.",
  already_running: "A world is already running. Reset it before starting another.",
  not_ready:
    "The world is still being built. You can switch the scene once the first picture is out.",
  missing_first_frame: "Add a first frame before starting.",
  missing_prompt: "Describe the scene before starting.",
  unsupported_media: "That file is not a PNG or JPEG image.",
  undecodable_image: "That image could not be read. Try another PNG or JPEG.",
  too_many_references: "Use at most five character pictures.",
  reference_too_elongated:
    "A character picture is longer than 2:1. Crop it closer to square and try again.",
  prompt_too_long: "That scene description is too long. Shorten it and try again.",
  action_too_long: "That action description is too long. Shorten it and try again.",
  unsupported_value: "The model did not accept that value.",
  start_failed:
    "The world could not be built from these inputs. Your inputs are kept: try again or change them.",
};

export function describeRefusal(code: string | undefined, message?: string) {
  const known = code ? REFUSALS[code] : undefined;
  return known ?? message ?? "The model refused that command.";
}
