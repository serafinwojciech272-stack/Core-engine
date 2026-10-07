export type CommercialOfferItem = {
  id: string; name: string; quantity: number; unit: string;
  unitPriceNet: number; net: number; vatRate: number; gross: number;
  pricingSource: "INPUT" | "ASSUMPTION";
};
export type CommercialOffer = {
  version: "commercial-offer-v1";
  state: "READY" | "AWAITING_INPUT";
  title: string; customer: string | null; currency: "PLN";
  items: CommercialOfferItem[];
  totals: { net: number; vat: number; gross: number };
  terms: { validityDays: number; paymentDays: number };
  assumptions: string[]; missingInputs: string[]; sourceRequest: string;
};
function numberFrom(text: string, patterns: RegExp[], fallback: number) {
  for (const pattern of patterns) { const m = text.match(pattern); if (m?.[1]) return Number(m[1].replace(",", ".")); }
  return fallback;
}
function round2(n: number) { return Math.round(n * 100) / 100; }
export function buildCommercialOffer(input: { request: string; customer?: string | null; pricing?: Record<string, number> }): CommercialOffer {
  const request = input.request.trim().slice(0, 12000);
  const lower = request.toLowerCase();
  const people = Math.max(1, Math.round(numberFrom(request, [/(\\d+)\\s*(?:osób|osoby|uczestników|uczestnicy|people|participants)/i, /(?:dla|for)\\s+(\\d+)\\s*(?:osób|osoby|participants|people)/i], 20)));
  const days = Math.max(1, Math.round(numberFrom(request, [/(\\d+)\\s*(?:dni|day|days)/i, /(?:przez|for)\\s+(\\d+)\\s*(?:dni|days)/i], 1)));
  const customerMatch = request.match(/(?:firma|klient|customer|company)\\s*[:=-]\\s*([^\\n,]+)/i);
  const customer = input.customer?.trim() || customerMatch?.[1]?.trim() || null;
  const prices = {
    accommodationPerPersonNight: input.pricing?.accommodationPerPersonNight ?? 350,
    conferenceRoomPerDay: input.pricing?.conferenceRoomPerDay ?? 2500,
    cateringPerPersonDay: input.pricing?.cateringPerPersonDay ?? 180,
    avPerDay: input.pricing?.avPerDay ?? 1200
  };
  const items: CommercialOfferItem[] = [];
  const add = (id: string, name: string, quantity: number, unit: string, unitPriceNet: number, pricingSource: "INPUT"|"ASSUMPTION") => {
    const net = round2(quantity * unitPriceNet); const vat = round2(net * 0.23);
    items.push({ id, name, quantity, unit, unitPriceNet, net, vatRate: 23, gross: round2(net + vat), pricingSource });
  };
  const assumptions: string[] = [];
  const source = input.pricing ? "INPUT" : "ASSUMPTION";
  if (/nocleg|noclegi|zakwater|hotel|overnight|accommodation/i.test(lower)) {
    add("accommodation", "Zakwaterowanie", people * days, "osobonoc", prices.accommodationPerPersonNight, source);
    if (!input.pricing?.accommodationPerPersonNight) assumptions.push("Zakwaterowanie: 350 PLN netto za osobonoc.");
  }
  if (/sala|konferenc|venue|room/i.test(lower)) {
    add("venue", "Sala konferencyjna", days, "dzień", prices.conferenceRoomPerDay, source);
    if (!input.pricing?.conferenceRoomPerDay) assumptions.push("Sala konferencyjna: 2500 PLN netto za dzień.");
  }
  if (/catering|wyżyw|lunch|kolacj|śniad|food|meal/i.test(lower)) {
    add("catering", "Catering", people * days, "osobodzień", prices.cateringPerPersonDay, source);
    if (!input.pricing?.cateringPerPersonDay) assumptions.push("Catering: 180 PLN netto za osobodzień.");
  }
  if (/av|a\\/v|technika|nagłoś|projektor|technical|technology/i.test(lower)) {
    add("av", "Technika AV", days, "dzień", prices.avPerDay, source);
    if (!input.pricing?.avPerDay) assumptions.push("Technika AV: 1200 PLN netto za dzień.");
  }
  if (!items.length) {
    add("service", "Usługa zgodna z zapytaniem klienta", 1, "pakiet", 0, "INPUT");
    assumptions.push("Brak danych do automatycznego rozbicia zakresu na pozycje.");
  }
  const missingInputs: string[] = [];
  if (!customer) missingInputs.push("customer");
  if (!input.pricing) missingInputs.push("confirmed_pricing");
  if (items.some(x => x.unitPriceNet === 0)) missingInputs.push("scope_pricing");
  const net = round2(items.reduce((s, x) => s + x.net, 0));
  const gross = round2(items.reduce((s, x) => s + x.gross, 0));
  return {
    version: "commercial-offer-v1", state: missingInputs.length ? "AWAITING_INPUT" : "READY",
    title: customer ? "Oferta handlowa dla " + customer : "Projekt oferty handlowej",
    customer, currency: "PLN", items,
    totals: { net, vat: round2(gross - net), gross },
    terms: { validityDays: 14, paymentDays: 30 },
    assumptions, missingInputs: [...new Set(missingInputs)], sourceRequest: request
  };
}
