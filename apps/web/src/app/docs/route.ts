import { forward } from "@/lib/apiProxy";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return forward(request, "/docs");
}
