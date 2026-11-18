import type { ReactorError } from "@reactor-team/js-sdk";

// What to tell the person when a command is refused. A refusal fails its own
// call: the typed method resolves `undefined` and the SDK reports a
// ReactorError with `operation: "sendCommand"` and the model's `code`. The
// model's own message is already written for people; these lines only replace
// it where a shorter one reads better in this UI.
const FRIENDLY: Record<string, string> = {
  content_policy: "That prompt or image was declined. Try something different.",
  invalid_image: "That image could not be used. Try a PNG, JPEG, or WEBP under 20 MB.",
  not_live: "The character is not listening yet. Wait a moment.",
  busy: "Hold on, the previous step is still running.",
  upstream_capacity: "No generation capacity is free right now. Try again in a few seconds.",
};

/** The `code` a command refusal carries, or null for any other error. */
export function refusalCode(error: ReactorError | undefined): string | null {
  if (!error || error.operation !== "sendCommand") return null;
  return error.code;
}

/** A sentence to show for an error the SDK reported. */
export function describeError(error: { code?: string; message: string }): string {
  if (error.code && FRIENDLY[error.code]) return FRIENDLY[error.code];
  // "command 'enqueue' failed (invalid_input): The prompt is blank." → the reason.
  const reason = /\):\s*(.+)$/s.exec(error.message)?.[1];
  return reason ?? error.message;
}
