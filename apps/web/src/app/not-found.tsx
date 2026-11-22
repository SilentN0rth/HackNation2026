import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles.css";
import type { Metadata } from "next";
import { Layout } from "@/components/Layout";
import { NotFoundView } from "@/features/NotFoundView";

export const metadata: Metadata = { title: "Nie znaleziono · e-Formularze" };

export default function NotFound() {
  return (
    <html lang="pl">
      <body>
        <Layout>
          <NotFoundView />
        </Layout>
      </body>
    </html>
  );
}
