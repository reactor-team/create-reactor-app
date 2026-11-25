import { Header } from "./components/Header";
export function SetupRequired() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl p-6 pt-20">
        <div className="panel space-y-5">
          <p className="eyebrow">Before you play</p>
          <h2 className="text-base font-semibold text-zinc-100">
            Setup required
          </h2>
          <p>
            Get a Reactor API key with ABot World Halo access from{" "}
            <a
              className="underline text-brand"
              href="https://www.reactor.inc/account/api-keys"
            >
              your API keys page
            </a>
            .
          </p>
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code>, add your
            key, then restart the server.
          </p>
          <pre className="overflow-auto rounded-lg bg-black/30 p-3 text-sm">
            REACTOR_API_KEY=rk_your_key_here
          </pre>
          <p className="text-sm text-zinc-500">
            Your API key stays on the server. The browser receives a short-lived
            token scoped to this model.
          </p>
        </div>
      </main>
    </>
  );
}
