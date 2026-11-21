import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Layout } from "@/components/Layout";

export const metadata: Metadata = {
  title: { default: "e-Formularze", template: "%s · e-Formularze" },
  description: "Cyfryzacja formularzy urzędowych z podstawą prawną każdego pola.",
  applicationName: "e-Formularze",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
