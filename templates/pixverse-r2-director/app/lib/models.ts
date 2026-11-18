// The model this app drives. It must equal MODEL_NAME in the typed SDK,
// @reactor-models/pixverse-r2-director: the token is scoped to it, and a scope
// that doesn't match the model the provider connects to mints fine but fails
// on connect().
//
// A plain string on purpose: the token route imports this file on the server,
// where the typed SDK (and the browser-only Reactor client) must not load.
export const MODEL_NAME = "reactor/pixverse-r2-director";
