import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "600"
};

export function middleware(request: Request) {
  const response = request.method === "OPTIONS"
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: ["/api/engine/:path*"]
};
