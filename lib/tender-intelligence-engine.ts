import { createHash } from "node:crypto";
import type { BuyerQuestion, Priority } from "@/app/tender-intelligence/zabrze/data";
import type { ParsedTenderDocument } from "@/lib/tender-parser";

export type TenderFact={key:string;value:string;normalized:string|number|null;sourceDocuments:string[];confidence:"CONFIRMED"|"PARTIAL"|"CONTRADICTED"|"NOT_FOUND"};
export type TenderRisk={id:string;priority:"CRITICAL"|"HIGH"|"MEDIUM"|"LOW";area:string;statement:string;evidence:string[];pricingImpact:"VERY_HIGH"|"HIGH"|"MEDIUM"|"LOW";mitigation:string;status:"OPEN"|"MITIGATED"|"BLOCKED"};
export type TenderDataset={caseId:string;generatedAt:string;documentCount:number;documentHashes:Record<string,string>;facts:TenderFact[];contradictions:{key:string;values:{value:string;documents:string[]}[]}[];costDrivers:string[];risks:TenderRisk[];questions:BuyerQuestion[];bidReadiness:{score:number;status:"NOT_READY"|"CONDITIONAL"|"READY";blockers:string[]}};
const clean=(s:string)=>s.replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();
const allText=(docs:ParsedTenderDocument[])=>docs.map(d=>`[${d.name}]
${d.text}`).join("

");
const matches=(text:string,re:RegExp)=>Array.from(text.matchAll(re)).map(m=>clean(m[1]||m[0])).filter(Boolean);
const unique=(v:string[])=>[...new Set(v)];
function makeQuestions(docs:ParsedTenderDocument[],risks:TenderRisk[]):BuyerQuestion[]{const text=allText(docs),qs:BuyerQuestion[]=[];const add=(id:string,priority:Priority,area:string,issue:string,rationale:string,pricingImpact:string,question:string,evidence:string)=>qs.push({id,priority,area,issue,rationale,pricingImpact,question,evidence});
if(!/(wolumen|ilości|Mg|ton|tony|pojemnik|częstotliwo)/i.test(text))add("Q-P1-01","P1","OPZ / wolumeny","Nie odnaleziono jednoznacznej tabeli wolumenowej w ekstrakcji.","Bez wolumenów per strumień nie da się obronić modelu kosztowego.","Bardzo wysoki","Prosimy o wskazanie wiążących wolumenów przyjmowanych do kalkulacji ceny, z podziałem na frakcje, jednostki i okresy.","Cross-document extraction");
if(risks.some(r=>/recykling/i.test(r.area)))add("Q-P1-03","P1","Recykling / PPU","Wykryto wymagania recyklingowe, ale metoda rozliczenia wymaga jednoznacznego źródła.","Punktacja i odpowiedzialność kontraktowa mogą zmieniać koszt i ryzyko.","Bardzo wysoki","Prosimy o potwierdzenie definicji, wzoru, źródeł danych, okresów pomiarowych i skutków niewykonania zadeklarowanego poziomu recyklingu.","OPZ / PPU / ogłoszenie");
if(/(elektromobil|pojazd.*elektry|zeroemisyj)/i.test(text))add("Q-P1-05","P1","Elektromobilność","Dokumentacja zawiera wymagania elektromobilności.","Wymóg może wpływać na CAPEX, flotę i harmonogram mobilizacji.","Wysoki","Prosimy o potwierdzenie minimalnego udziału pojazdów, terminów spełnienia wymogu i sposobu dokumentowania zgodności.","Dokument elektromobilności");
if(/(waloryz|indeks|wskaźnik)/i.test(text))add("Q-P2-02","P2","Waloryzacja","W dokumentach występuje mechanizm waloryzacyjny.","Baza i limity indeksacji wpływają na marżę w 36-miesięcznym kontrakcie.","Średni/Wysoki","Prosimy o wskazanie wskaźników, miesiąca bazowego, częstotliwości, progów i limitów waloryzacji.","PPU");
add("Q-P1-02","P1","XLS ↔ OPZ","Należy potwierdzić zgodność pozycji kalkulacyjnych z zakresem usług.","Błąd jednostki lub agregacji może prowadzić do błędnej ceny.","Bardzo wysoki","Prosimy o potwierdzenie dla każdej pozycji kalkulacji ceny jednostki rozliczeniowej, ilości oraz odpowiadającego jej zakresu OPZ.","Kalkulacja ceny + OPZ");
if(/przyjęcia odpadów[^
]{0,220}(?:1[.]01[.]2027|31[.]12[.]2027)/i.test(text))add("Q-P1-07","P1","Instalacje / capacity","Dokumentacja wymaga potwierdzenia możliwości przyjęcia odpadów w określonym okresie.","Brak zabezpieczenia mocy przerobowych może uniemożliwić realizację lub zwiększyć koszt zagospodarowania.","Bardzo wysoki","Prosimy o potwierdzenie wymaganych ilości i okresu dostępności instalacji oraz akceptowanych form zobowiązania podmiotu prowadzącego instalację.","SWZ / dokumenty przedmiotowe");
add("Q-P2-03","P2","Kary / SLA","Katalog sankcji powinien być zmapowany przed decyzją ofertową.","Kary są bezpośrednim elementem ceny ryzyka.","Średni/Wysoki","Prosimy o potwierdzenie pełnego katalogu kar, podstaw naliczenia, limitów łącznych oraz relacji kar do odszkodowania uzupełniającego.","PPU");
return qs}
function buildFacts(docs:ParsedTenderDocument[]):TenderFact[]{const facts:TenderFact[]=[],combined=allText(docs);const fact=(key:string,re:RegExp,normalize?:(v:string)=>string|number|null)=>{const values=docs.flatMap(d=>matches(d.text,re).map(v=>({v,doc:d.name}))),uv=unique(values.map(x=>x.v));facts.push({key,value:uv.join(" | ")||"NOT_FOUND",normalized:uv[0]?(normalize?normalize(uv[0]):uv[0]):null,sourceDocuments:unique(values.map(x=>x.doc)),confidence:uv.length===0?"NOT_FOUND":uv.length===1?"CONFIRMED":"CONTRADICTED"})};
fact("deadline",/(termin(?:u|em)? składania[^
]{0,120}?(\d{2}[.\-/]\d{2}[.\-/]\d{4}[^
]{0,40}\d{2}:\d{2}))/i);
fact("wadium",/(wadium[^
]{0,100}?([\d .]+\s*(?:zł|PLN)))/i,v=>v.replace(/[^\d]/g,"")?Number(v.replace(/[^\d]/g,"")):null);
fact("duration",/((?:36|trzydzieści sześć)\s*(?:miesięcy|miesi[aą]ce))/i);
fact("recycling",/((?:33|40|45|50)\s*%)/i);
fact("caseReference",/(BZP\.271\.60\.2026\.MK)/i);
fact("performanceSecurity",/(5\s*%[^
]{0,100}(?:zabezpieczenia należytego wykonania|zabezpieczenia należytego wykonania umowy))/i);
fact("installationCapacity",/(przyjęcia odpadów[^
]{0,220}(?:1[.]01[.]2027|31[.]12[.]2027))/i);
fact("pricingWeights",/(W1[^
]{0,180}W17)/i);
if(/(20\s*%[^
]{0,80}wartości|zwiększenie.*20\s*%)/i.test(combined))facts.push({key:"option20pct",value:"20%",normalized:20,sourceDocuments:docs.map(d=>d.name),confidence:"CONFIRMED"});
return facts}
function buildRisks(docs:ParsedTenderDocument[],facts:TenderFact[],contradictions:TenderDataset["contradictions"]):TenderRisk[]{const text=allText(docs),risks:TenderRisk[]=[];const add=(id:string,priority:TenderRisk["priority"],area:string,statement:string,evidence:string[],pricingImpact:TenderRisk["pricingImpact"],mitigation:string,status:TenderRisk["status"]="OPEN")=>risks.push({id,priority,area,statement,evidence,pricingImpact,mitigation,status});
if(contradictions.length)add("RISK-XDOC-01","CRITICAL","Cross-document","Źródła zawierają rozbieżne wartości dla co najmniej jednego faktu kluczowego.",contradictions.flatMap(c=>c.values.map(v=>v.documents.join(", "))),"VERY_HIGH","Zatrzymać final pricing do wyjaśnienia rozbieżności.");
if(facts.some(f=>f.key==="recycling"))add("RISK-REC-01","HIGH","Recykling","Wymagania recyklingowe mają bezpośredni wpływ na ocenę i ryzyko kontraktowe.",facts.find(f=>f.key==="recycling")?.sourceDocuments||[],"VERY_HIGH","Policzyć koszt każdego poziomu i potwierdzić mechanizm sankcji.");
if(!facts.some(f=>f.key==="deadline"&&f.confidence==="CONFIRMED"))add("RISK-DATE-01","HIGH","Formal","Termin składania nie został jednoznacznie potwierdzony z ekstrakcji dokumentowej.",docs.map(d=>d.name),"HIGH","Zweryfikować termin w ogłoszeniu i platformie przed submission.");
if(!facts.some(f=>f.key==="wadium"&&f.confidence==="CONFIRMED"))add("RISK-WAD-01","HIGH","Wadium","Kwota wadium nie została jednoznacznie potwierdzona z dokumentów wejściowych.",docs.map(d=>d.name),"HIGH","Zweryfikować kwotę, formy i termin wniesienia.");
if(!/(ilości|wolumen|Mg|ton)/i.test(text))add("RISK-VOL-01","CRITICAL","Wolumen","Brak wiarygodnie wykrytych danych ilościowych w zasileniu parsera.",docs.map(d=>d.name),"VERY_HIGH","Nie zatwierdzać ceny bez tabel wolumenowych.");
if(/(elektromobil)/i.test(text))add("RISK-FLEET-01","HIGH","Flota","Wymagania elektromobilności mogą powodować CAPEX i ograniczenia mobilizacyjne.",docs.filter(d=>/elektromobil/i.test(d.text)).map(d=>d.name),"HIGH","Zmapować wymogi na flotę, terminy i koszt.");
if(/przyjęcia odpadów[^
]{0,220}(?:1[.]01[.]2027|31[.]12[.]2027)/i.test(text))add("RISK-TREATMENT-01","HIGH","Zagospodarowanie","Wymóg potwierdzenia zdolności instalacji do przyjęcia odpadów może ograniczać dostępność mocy i zwiększać koszt.",docs.filter(d=>/przyjęcia odpadów|instalac/i.test(d.text)).map(d=>d.name),"VERY_HIGH","Pozyskać podpisane zobowiązania instalacji i zweryfikować pokrycie wolumenów.");
if(/(kara|kary umowne)/i.test(text))add("RISK-CONTRACT-01","HIGH","PPU","Dokumentacja zawiera reżim sankcyjny wymagający mapowania do jednostek kosztowych.",docs.filter(d=>/kara|kary umowne/i.test(d.text)).map(d=>d.name),"HIGH","Zbudować expected-risk allowance w modelu ceny.");
return risks}
export function normalizeTenderCase(caseId:string,docs:ParsedTenderDocument[]):TenderDataset{const facts=buildFacts(docs),contradictions:TenderDataset["contradictions"]=[];for(const f of facts)if(f.confidence==="CONTRADICTED")contradictions.push({key:f.key,values:f.value.split(" | ").map(value=>({value,documents:f.sourceDocuments}))});const risks=buildRisks(docs,facts,contradictions),questions=makeQuestions(docs,risks),blockers:string[]=[];if(!facts.some(f=>f.key==="deadline"&&f.confidence==="CONFIRMED"))blockers.push("deadline not document-confirmed");if(!facts.some(f=>f.key==="wadium"&&f.confidence==="CONFIRMED"))blockers.push("wadium not document-confirmed");if(risks.some(r=>r.priority==="CRITICAL"&&r.status==="OPEN"))blockers.push("critical risk open");if(!questions.some(q=>q.priority==="P1"))blockers.push("P1 question set incomplete");const score=Math.max(0,Math.min(100,100-blockers.length*20-risks.filter(r=>r.priority==="HIGH").length*7-contradictions.length*15));return{caseId,generatedAt:new Date().toISOString(),documentCount:docs.length,documentHashes:Object.fromEntries(docs.map(d=>[d.name,d.sha256])),facts,contradictions,costDrivers:["waste volumes","collection frequency and routing","treatment/recycling cost","fleet and electromobility","labour and mobilisation","container handling","penalties and indexation"],risks,questions,bidReadiness:{score,status:score>=85?"READY":score>=60?"CONDITIONAL":"NOT_READY",blockers}}}
export function fingerprintDataset(dataset:TenderDataset){return createHash("sha256").update(JSON.stringify(dataset)).digest("hex")}