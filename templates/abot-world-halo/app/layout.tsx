import type { Metadata } from "next";
import "@reactor-team/ui/styles.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "ABot World Halo · Game world",
  description:
    "Walk a character through a generated game world, with sound, using ABot World Halo on Reactor.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
