import { SetupRequired } from "./SetupRequired";
import { Studio } from "./Studio";

export const dynamic = "force-dynamic";

export default function Page() {
  const configured = Boolean(process.env.REACTOR_API_KEY);
  const preview = process.env.LOCAL_PREVIEW === "1";
  if (!configured && !preview) return <SetupRequired />;
  return <Studio configured={configured} />;
}
