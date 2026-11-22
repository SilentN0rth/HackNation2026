const API = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");
const FORWARDED = ["content-type", "content-length", "authorization", "x-api-key", "accept"];

export async function forward(request: Request, path: string): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  };
  const upstream = await fetch(`${API}${path}${new URL(request.url).search}`, init);
  const response = new Headers(upstream.headers);
  response.delete("content-encoding");
  response.delete("content-length");
  response.delete("transfer-encoding");
  return new Response(upstream.body, { status: upstream.status, headers: response });
}
