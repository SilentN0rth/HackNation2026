import { notFound } from "next/navigation";

// Kilka root layoutów (frontend + Payload) – nieznane ścieżki łapiemy tutaj, żeby 404 miało <Layout>.
export default function CatchAll() {
  notFound();
}
