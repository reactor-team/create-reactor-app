export function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Setup required
        </span>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">
          Add a Reactor API key
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          This app mints short-lived, session-scoped tokens on the server. The
          key itself never reaches the browser.
        </p>
        <ol className="mt-4 space-y-3 text-sm text-zinc-300">
          <li>
            <span className="text-zinc-500">1.</span> Create a key at{" "}
            <a
              href="https://www.reactor.inc/account/api-keys"
              className="text-brand underline"
            >
              reactor.inc/account/api-keys
            </a>
            .
          </li>
          <li>
            <span className="text-zinc-500">2.</span> Save it to{" "}
            <code className="font-mono text-xs text-zinc-200">.env.local</code>:
            <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">
              REACTOR_API_KEY=rk_...
            </pre>
          </li>
          <li>
            <span className="text-zinc-500">3.</span> Restart the dev server.
          </li>
        </ol>
      </div>
    </div>
  );
}
