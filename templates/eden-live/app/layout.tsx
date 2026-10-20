import type { Metadata } from "next";
import "@reactor-team/ui/styles.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "EdenLive · Reactor",
  description: "Play a game and watch EdenLive render it as a new world in real time.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
