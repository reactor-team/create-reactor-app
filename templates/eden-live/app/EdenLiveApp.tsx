"use client";
import { REACTOR_API_URL } from "./lib/config";
import { EdenLiveProvider } from "./lib/model";
import { fetchToken } from "./lib/token";
import { Playground } from "./components/Playground";
const OPTIONS = { autoConnect: false, autoResumeTracks: true };
export function EdenLiveApp() {
  return (
    <EdenLiveProvider
      apiUrl={REACTOR_API_URL}
      jwtToken={fetchToken}
      connectOptions={OPTIONS}
    >
      <Playground />
    </EdenLiveProvider>
  );
}
