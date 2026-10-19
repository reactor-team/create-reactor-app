export function SetupRequired() {
  return (
    <main className="setup">
      <span className="eyebrow">Setup required</span>
      <h1>EdenLive</h1>
      <p>Play a game and watch it rendered as a new world in real time.</p>
      <section className="panel">
        <h2>Set up your API key</h2>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, set{" "}
          <code>REACTOR_API_KEY</code> to a key authorized for{" "}
          <code>reactor/eden-live</code>, then restart the development server.
        </p>
        <a
          href="https://www.reactor.inc/account/api-keys"
          target="_blank"
          rel="noreferrer"
        >
          Manage API keys ↗
        </a>
      </section>
    </main>
  );
}
