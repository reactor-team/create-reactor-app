export interface DiagnosticEntry {
  id: number;
  at: number;
  code: string;
  operation: string;
  message: string;
  sessionId: string | null;
  status?: number;
  recoverable?: boolean;
  cause?: { name: string | null; message: string };
}

export interface DiagnosticState {
  entries: DiagnosticEntry[];
  sessionId: string | null;
  nextId: number;
}

export type DiagnosticReporter = (error: unknown, operation?: string) => void;
export type DiagnosticAction =
  | { type: "session"; sessionId?: string }
  | { type: "clear" }
  | {
      type: "error";
      error: unknown;
      operation?: string;
      sessionId?: string;
      at: number;
    };

export const INITIAL_DIAGNOSTICS: DiagnosticState = {
  entries: [],
  sessionId: null,
  nextId: 1,
};

function identifier(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(value)
    ? value
    : null;
}

// Keep only a bounded first-line description, never a stack or request URL.
export function diagnosticMessage(error: unknown): string {
  const source =
    error && typeof error === "object"
      ? (error as { message?: unknown }).message
      : error;
  if (typeof source !== "string") return "An operation failed.";
  return source
    .split(/[\r\n]/, 1)[0]
    .replace(/\b(?:https?|wss?|blob):\/\/\S+|data:\S+/gi, "[URL removed]")
    .replace(/\bBearer\s+\S+/gi, "[credential removed]")
    .replace(/\b(?:rk_|sk_|ghp_|xoxb-)[A-Za-z0-9._-]+/g, "[credential removed]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[credential removed]"
    )
    .replace(
      /(["']?(?:authorization|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|jwt|token|password|cookie)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      "$1[credential removed]"
    )
    .slice(0, 320);
}

export function diagnosticReducer(
  state: DiagnosticState,
  action: DiagnosticAction
): DiagnosticState {
  if (action.type === "clear") return { ...state, entries: [] };
  const sessionId = identifier(action.sessionId) ?? state.sessionId;
  if (action.type === "session")
    return sessionId === state.sessionId ? state : { ...state, sessionId };
  const source =
    action.error && typeof action.error === "object"
      ? (action.error as {
          code?: unknown;
          operation?: unknown;
          status?: unknown;
          recoverable?: unknown;
          cause?: unknown;
        })
      : {};
  const cause =
    source.cause && typeof source.cause === "object"
      ? (source.cause as { name?: unknown; message?: unknown })
      : null;
  const hasCauseMessage =
    typeof source.cause === "string" || typeof cause?.message === "string";
  const entry: DiagnosticEntry = {
    id: state.nextId,
    at: action.at,
    code: identifier(source.code) ?? "LOCAL_ERROR",
    operation:
      identifier(source.operation) ?? identifier(action.operation) ?? "sdk",
    message: diagnosticMessage(action.error),
    sessionId,
    status:
      typeof source.status === "number" &&
      source.status >= 100 &&
      source.status <= 599
        ? source.status
        : undefined,
    recoverable:
      typeof source.recoverable === "boolean" ? source.recoverable : undefined,
    cause:
      hasCauseMessage || identifier(cause?.name)
        ? {
            name: identifier(cause?.name),
            message: hasCauseMessage ? diagnosticMessage(source.cause) : "",
          }
        : undefined,
  };
  return {
    entries: [...state.entries, entry].slice(-5),
    sessionId,
    nextId: state.nextId + 1,
  };
}
