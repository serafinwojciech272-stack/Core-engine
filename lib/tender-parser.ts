import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { OfficeParser } from "@jose.espana/docstream";

export type ParsedTenderDocument = {
  name: string;
  format: string;
  bytes: number;
  sha256: string;
  text: string;
  markdown: string;
  headings: string[];
  tables: string[][];
  source: "uploaded" | "official-intake";
};

const EXTENSIONS = new Set(["pdf","doc","docx","xls","xlsx","rtf","odt","ods","ppt","pptx","csv","txt","md","html"]);

function ext(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

function flattenTables(nodes: any[], out: string[][] = []) {
  for (const node of nodes || []) {
    if (node?.type === "table") {
      const rows = (node.children || []).filter((x: any) => x?.type === "row").map((row: any) =>
        (row.children || []).filter((x: any) => x?.type === "cell").map((cell: any) => String(cell?.text ?? "").replace(/\s+/g, " ").trim())
      );
      if (rows.length) out.push(...rows);
    }
    if (node?.children) flattenTables(node.children, out);
  }
  return out;
}

function headings(nodes: any[], out: string[] = []) {
  for (const node of nodes || []) {
    if (node?.type === "heading" && node.text) out.push(String(node.text).trim());
    if (node?.children) headings(node.children, out);
  }
  return out;
}

export async function parseTenderDocument(buffer: Uint8Array, name: string, source: ParsedTenderDocument["source"] = "uploaded"): Promise<ParsedTenderDocument> {
  const format = ext(name);
  if (!EXTENSIONS.has(format)) throw new Error("UNSUPPORTED_DOCUMENT_FORMAT:" + format);
  const sha256 = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const ast: any = await OfficeParser.parseOffice(Buffer.from(buffer), { fileType: format as any, newlineDelimiter: "\n" });
  const text = String(ast.toText?.() ?? "").trim();
  const markdown = String(ast.toMarkdown?.() ?? "").trim();
  return {
    name,
    format,
    bytes: buffer.byteLength,
    sha256,
    text,
    markdown,
    headings: headings(ast.content),
    tables: flattenTables(ast.content),
    source,
  };
}

export async function parseTenderZip(buffer: Uint8Array, zipName: string, source: ParsedTenderDocument["source"] = "uploaded") {
  const entries = unzipSync(buffer);
  const results: ParsedTenderDocument[] = [];
  for (const [name, data] of Object.entries(entries)) {
    if (!data.byteLength || name.endsWith("/")) continue;
    if (!EXTENSIONS.has(ext(name))) continue;
    results.push(await parseTenderDocument(data, name, source));
  }
  return results;
}
