import { Genie4App } from "./Genie4App";
import { SetupRequired } from "./SetupRequired";
export const dynamic = "force-dynamic";
export default function Page() {
  return process.env.REACTOR_API_KEY ? <Genie4App /> : <SetupRequired />;
}
