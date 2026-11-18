import { DirectorApp } from "./DirectorApp";
import { SetupRequired } from "./SetupRequired";

export const dynamic = "force-dynamic";

export default function Page() {
  return process.env.REACTOR_API_KEY ? <DirectorApp /> : <SetupRequired />;
}
