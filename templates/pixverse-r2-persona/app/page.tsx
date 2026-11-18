import { PersonaApp } from "./PersonaApp";
import { SetupRequired } from "./SetupRequired";

export const dynamic = "force-dynamic";

export default function Page() {
  return process.env.REACTOR_API_KEY ? <PersonaApp /> : <SetupRequired />;
}
