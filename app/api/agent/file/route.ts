import { NextResponse } from "next/server";
import { OfficeParser } from "@jose.espana/docstream";
import { guardMutation } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["pdf","xls","xlsx","doc","docx","csv","txt","json","ppt","pptx","odt","ods","rtf","png","jpg","jpeg","webp"]);

function ext(name: string) { return name.toLowerCase().split(".").pop() || ""; }

function summarize(text: string) {
  const clean = text.replace(/\u0000/g, "").replace(/\r/g, "");
  const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
  const lines = clean ? clean.split("\n").filter(Boolean).length : 0;
  const numbers = (clean.match(/[-+]?\d+(?:[.,]\d+)?/g) || []).length;
  const warnings = [...new Set((clean.match(/\b(?:risk|risks|warning|problem|issue|debt|loss|penalty|deadline|termination|conflict|error|critical)\b/gi) || []).map(x => x.toLowerCase()))].slice(0, 12);
  return { characters: clean.length, words, lines, numericTokens: numbers, riskKeywords: warnings };
}

export async function POST(request: Request) {
  const guard = guardMutation(request, "agent-file");
  if (guard) return guard;
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const rl = rateLimit("agent-file:" + ip);
  if (!rl.allowed) return NextResponse.json({ ok:false, error:"RATE_LIMITED" }, { status:429 });

  try {
    const form = await request.formData();
    const entries = form.getAll("file").filter((x): x is File => x instanceof File);
    if (!entries.length) return NextResponse.json({ok:false,error:"FILE_REQUIRED"},{status:400});
    if (entries.length > 6) return NextResponse.json({ok:false,error:"TOO_MANY_FILES"},{status:400});

    const results = [];
    for (const file of entries) {
      if (file.size > MAX_BYTES) return NextResponse.json({ok:false,error:"FILE_TOO_LARGE",file:file.name},{status:413});
      const extension = ext(file.name);
      if (!ALLOWED.has(extension)) return NextResponse.json({ok:false,error:"UNSUPPORTED_FILE_TYPE",file:file.name},{status:415});
      const buffer = Buffer.from(await file.arrayBuffer());
      let text = "";
      let metadata: Record<string, unknown> = {};
      if (file.type.startsWith("image/") || ["png","jpg","jpeg","webp"].includes(extension)) {
        metadata = { mediaType: "image", width: null, height: null, editable: true, dataUrl: "data:" + (file.type || "image/png") + ";base64," + buffer.toString("base64") };
      } else {
        try {
          const ast = await OfficeParser.parseOffice(buffer);
          text = ast.toText();
          metadata = (ast.metadata || {}) as Record<string, unknown>;
        } catch (error) {
          return NextResponse.json({ok:false,error:"DOCUMENT_PARSE_FAILED",file:file.name,detail:error instanceof Error ? error.message : "parser error"},{status:422});
        }
      }
      const stats = summarize(text);
      results.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        extension,
        bytes: file.size,
        metadata,
        stats,
        extractedText: text.slice(0, 30000),
        markdown: astMarkdownSafe(text)
      });
    }

    return NextResponse.json({ok:true,contract:"document-intelligence-v1",count:results.length,files:results});
  } catch {
    return NextResponse.json({ok:false,error:"FILE_INTELLIGENCE_FAILED"},{status:400});
  }
}

function astMarkdownSafe(text: string) {
  return text.slice(0, 30000);
}
