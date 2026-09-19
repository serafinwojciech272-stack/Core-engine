import { NextResponse } from "next/server";
import { verifyAuditChain, type AuditNode } from "@/lib/audit-chain";

const MAX_BODY_BYTES = 32_000;
const MAX_NODES = 20;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }

    const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const chain = body.chain;
    if (!Array.isArray(chain) || chain.length === 0) {
      return NextResponse.json({ ok: false, error: "AUDIT_CHAIN_REQUIRED" }, { status: 400 });
    }
    if (chain.length > MAX_NODES) {
      return NextResponse.json({ ok: false, error: "AUDIT_CHAIN_TOO_LARGE", max: MAX_NODES }, { status: 400 });
    }

    const result = await verifyAuditChain(chain as AuditNode[]);
    return NextResponse.json({
      ok: true,
      algorithm: "SHA-256 chained audit v1",
      integrity: result.valid ? "VERIFIED" : "INVALID",
      ...result
    }, { status: result.valid ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "AUDIT_VERIFY_FAILED" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/audit/verify",
    algorithm: "SHA-256 chained audit v1",
    status: "READY"
  });
}
