import { forward } from "@/lib/apiProxy";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: Context) {
  const { path } = await params;
  return forward(request, `/api/v1/${path.map(encodeURIComponent).join("/")}`);
}

export { handle as GET, handle as POST };
