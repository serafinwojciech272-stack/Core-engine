import { parseTenderDocument, parseTenderZip, type ParsedTenderDocument } from "../lib/tender-parser.ts";

const SOURCE = "https://zabrze.logintrade.net/zapytania_email,238598,f66e29363d9dcf5e140c48eece63b78c.html";
const HOST = "zabrze.logintrade.net";

function attachmentLinks(html: string) {
  const links: { name: string; url: string }[] = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
    const name = label || decodeURIComponent(href.split("/").pop() || "").split("?")[0];
    if (/\\.(pdf|docx?|xlsx?|zip|xml|rtf)$/i.test(name) || /\\.(pdf|docx?|xlsx?|zip|xml|rtf)(?:$|[?#])/i.test(href)) {
      links.push({ name, url: new URL(href, SOURCE).toString() });
    }
  }
  return links.filter((x, i, a) => a.findIndex(y => y.url === x.url) === i);
}

const source = new URL(SOURCE);
if (source.hostname !== HOST) throw new Error("OFFICIAL_HOST_MISMATCH");

const page = await fetch(SOURCE, { cache: "no-store", headers: { "user-agent": "Core-Engine-Tender-Intelligence-CI/1.0" } });
if (!page.ok) throw new Error(`OFFICIAL_SOURCE_FETCH_${page.status}`);
const html = await page.text();
const links = attachmentLinks(html);
if (links.length < 9) throw new Error(`OFFICIAL_ATTACHMENT_DISCOVERY_TOO_LOW:${links.length}`);

const parsed: ParsedTenderDocument[] = [];
const failures: string[] = [];
for (const link of links) {
  const response = await fetch(link.url, { cache: "no-store", headers: { "user-agent": "Core-Engine-Tender-Intelligence-CI/1.0" } });
  if (!response.ok) { failures.push(`${link.name}:HTTP_${response.status}`); continue; }
  const bytes = new Uint8Array(await response.arrayBuffer());
  try {
    if (/\\.zip$/i.test(link.name)) parsed.push(...await parseTenderZip(bytes, link.name, "official-intake"));
    else parsed.push(await parseTenderDocument(bytes, link.name, "official-intake"));
  } catch (error) {
    failures.push(`${link.name}:${error instanceof Error ? error.message : "PARSE_FAILED"}`);
  }
}

const names = parsed.map(x => x.name);
const required = [
  "ogłoszenie o zamówieniu.pdf",
  "Specyfikacja Warunków Zamówienia.doc",
  "Załącznik nr 1 do SWZ - Część III Szczegółowy opis przedmiotu zamówienia.doc",
  "Załącznik nr 2 do SWZ - Wzór umowy - Projektowane postanowienia umowy (PPU).doc",
  "Załącznik nr 5 do SWZ - KALKULACJA CENY.xls"
];
const missing = required.filter(name => !names.includes(name));
if (failures.length || missing.length) {
  console.error(JSON.stringify({ ok: false, discovered: links.map(x => x.name), parsed: names, failures, missing }, null, 2));
  process.exit(1);
}

const nonEmpty = parsed.filter(x => x.text.length > 50);
if (nonEmpty.length < 5) throw new Error(`OFFICIAL_PARSE_TEXT_TOO_LOW:${nonEmpty.length}`);

console.log(JSON.stringify({
  ok: true,
  source: SOURCE,
  discoveredCount: links.length,
  parsedCount: parsed.length,
  nonEmptyTextCount: nonEmpty.length,
  documents: parsed.map(x => ({ name: x.name, format: x.format, bytes: x.bytes, textLength: x.text.length, tableCount: x.tables.length, headingCount: x.headings.length, source: x.source }))
}, null, 2));
