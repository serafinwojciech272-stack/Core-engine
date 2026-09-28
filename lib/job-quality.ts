export type JobQualityInput = {
  source: string;
  url: string;
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
};

export const ALLOWED_JOB_SOURCES = [
  "pracuj.pl","indeed","olx","linkedin","nofluffjobs","justjoin.it",
  "rocketjobs","pracapolis","adzuna","jooble","jobs.pl"
] as const;

const localTerms = [
  "gliwice","zabrze","bytom","ruda śląska","tarnowskie góry",
  "knurów","pyskowice","chorzów"
];

const listingTitlePatterns = [
  /\b\d+\s+(ofert|oferty|jobs|job|results?)\b/i,
  /\bjobs?\s+in\b/i,
  /\bjob(?:s)?\s+(?:near|around|for)\b/i,
  /\bjob\s+search\b/i,
  /\bsearch\s+results?\b/i,
  /\boferty\s+pracy(?:\s+na\s+stanowisku)?\b/i,
  /\bpraca\s+.+\s+-\s+\d+\s+ofert/i,
  /\bcustomer service\s+english-speaking jobs\b/i,
  /\bjob description\b/i,
  /\bjobs description\b/i
];

const genericDescriptionPatterns = [
  /key account manager job description/i,
  /job description.*responsibilities/i,
  /what does a .* manager do/i,
  /career guide.*job description/i
];

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function hasLocalOrRemote(text: string) {
  const low = text.toLowerCase();
  return localTerms.some(term => low.includes(term)) ||
    /(?:cała polska|poland|remote|zdalna|hybrydowa)/i.test(text);
}

function providerDetailPath(source: string, url: URL) {
  const path = url.pathname.toLowerCase();
  const full = url.toString().toLowerCase();

  switch (source) {
    case "linkedin":
      return /\/jobs\/view\/\d+/.test(path);
    case "indeed":
      return /\/viewjob$/.test(path) || /\/rc\/clk$/.test(path);
    case "jooble":
      return /\/desc\//.test(path) || /\/job(?:\/|$)/.test(path);
    case "jobs.pl":
      return /\/oferta-[^/?#]+/.test(path);
    case "pracuj.pl":
      return /\/oferta,\d+/.test(path) || /,oferta,\d+/.test(path);
    case "olx":
      return /\/oferta\//.test(path) && /praca|oferta/.test(path);
    case "rocketjobs":
      return /\/oferta\//.test(path);
    case "nofluffjobs":
      return /\/job\//.test(path);
    case "justjoin.it":
      return /\/job\//.test(path);
    case "adzuna":
      return /\/details\//.test(path) || /\/job\//.test(path);
    case "pracapolis":
      return /\/oferta\//.test(path) || /\/job\//.test(path);
    default:
      return false;
  }
}

export function validateJobOpportunity(input: JobQualityInput) {
  const url = normalizeUrl(input.url);
  if (!url) return { valid: false, reason: "INVALID_URL" as const };

  const title = input.title.trim();
  const haystack = [title, input.company ?? "", input.location ?? "", input.description ?? ""].join(" ").trim();
  const lowUrl = url.toString().toLowerCase();

  if (!ALLOWED_JOB_SOURCES.includes(input.source as typeof ALLOWED_JOB_SOURCES[number])) {
    return { valid: false, reason: "SOURCE_NOT_ALLOWED" as const };
  }
  if (!title || title.length < 5) return { valid: false, reason: "TITLE_TOO_SHORT" as const };
  if (listingTitlePatterns.some(pattern => pattern.test(title))) {
    return { valid: false, reason: "LISTING_TITLE" as const };
  }
  if (/(?:^|[/?=&;])(search|szukaj|wyszukiwarka|wyniki|results|collections?)(?:[/?=&;]|$)/i.test(lowUrl)) {
    return { valid: false, reason: "LISTING_URL" as const };
  }
  if (/[?&](?:q|query|keywords|search|page|pn)=/i.test(lowUrl)) {
    return { valid: false, reason: "LISTING_URL" as const };
  }
  if (genericDescriptionPatterns.some(pattern => pattern.test(haystack))) {
    return { valid: false, reason: "GENERIC_JOB_DESCRIPTION" as const };
  }
  if (!providerDetailPath(input.source, url)) {
    return { valid: false, reason: "PROVIDER_NOT_DETAIL" as const };
  }
  if (!hasLocalOrRemote(haystack)) {
    return { valid: false, reason: "OUT_OF_GEO_SCOPE" as const };
  }

  const hasRoleSignal = /manager|business development|operations|customer|sales|account|export|commercial|process|team leader|supervisor|order management|specjalista|kierownik|koordynator/i.test(title);
  if (!hasRoleSignal) return { valid: false, reason: "NO_ROLE_SIGNAL" as const };

  return { valid: true, reason: "VALID_DETAIL" as const };
}

export function isValidJobOpportunity(input: JobQualityInput) {
  return validateJobOpportunity(input).valid;
}
