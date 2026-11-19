import type { Metadata } from "next";
import "@reactor-team/ui/styles.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Genie 4 · World explorer",
  description:
    "Explore interactive worlds with Google DeepMind Genie 4 and Reactor.",
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
