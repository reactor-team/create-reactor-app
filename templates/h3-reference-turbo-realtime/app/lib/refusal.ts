// Reading a refused command out of the SDK's `error` event.
//
// A refusal reaches the app as a failure with `operation: "sendCommand"`,
// `code` set to the model's code (`queue_full`), and a message the SDK words
// `command 'enqueue' failed (queue_full): The generation queue is full.`
// The code is typed and stable, so it decides what the failure is. The
// message is parsed only for the command name and the model's reason, and
// refusal.test.mjs pins that wording, so an SDK that rewords it fails a test
// here instead of changing what every app shows.
//
// This module has no imports, so `node --test` runs its tests without an
// install.

export type Refusal = { command: string; code: string; reason: string };

/** The fields of the SDK's `ReactorError` this module reads. */
export type CommandFailure = {
  code: string;
  message: string;
  operation?: string | undefined;
};

export const GENERIC_REFUSAL = "The model refused this command.";

const COMMAND_FAILURE = /^command '([^']+)' failed \(([^)]*)\): ([\s\S]*)$/;

/** The SDK's own codes are upper case (`INVALID_STATE`); a model's are
 *  snake_case (`queue_full`). */
const MODEL_CODE = /^[a-z][a-z0-9_]*$/;

/** The refusal `failure` reports for `command`. A model's refusal whose
 *  message does not parse keeps its code and shows the generic reason, never
 *  the SDK's wording. A failure the SDK raised itself (no session yet, say)
 *  shows the SDK's message. */
export function refusalOf(command: string, failure: CommandFailure): Refusal {
  const match = COMMAND_FAILURE.exec(failure.message);
  if (match)
    return { command, code: failure.code || match[2], reason: match[3] };
  if (MODEL_CODE.test(failure.code)) {
    return { command, code: failure.code, reason: GENERIC_REFUSAL };
  }
  return { command, code: failure.code, reason: failure.message };
}

/** True for a failure that belongs to `command`. A failure whose message
 *  names no command (one that never reached the model, or one the SDK
 *  worded another way) belongs to whichever call is in flight. */
export function belongsTo(command: string, failure: CommandFailure): boolean {
  if (failure.operation !== "sendCommand") return false;
  const match = COMMAND_FAILURE.exec(failure.message);
  return !match || match[1] === command;
}
