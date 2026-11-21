import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: { default: "e-Formularze", template: "%s · e-Formularze" },
  description: "Cyfryzacja formularzy urzędowych z podstawą prawną każdego pola.",
  applicationName: "e-Formularze",
  appleWebApp: { capable: true, title: "e-Formularze", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
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
        <ServiceWorker />
      </body>
    </html>
  );
}
