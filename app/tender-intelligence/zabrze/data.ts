export type Confidence = "CONFIRMED" | "PARTIAL" | "REQUIRES_VERIFICATION";
export type Priority = "P1" | "P2" | "P3";

export type Requirement = {
  id: string;
  area: string;
  requirement: string;
  evidence: string;
  status: Confidence;
  impact: string;
  action: string;
};

export type BuyerQuestion = {
  id: string;
  priority: Priority;
  area: string;
  issue: string;
  rationale: string;
  pricingImpact: string;
  question: string;
  evidence: string;
};

export const tenderFacts = {
  title: "Odbiór i zagospodarowanie odpadów komunalnych od właścicieli nieruchomości położonych na terenie miasta Zabrze",
  proceedingId: "Z154/68879",
  reference: "BZP.271.60.2026.MK",
  procedureId: "76255447-27be-4cb4-bd1c-1bec533e2fee",
  buyer: "Miasto Zabrze – Prezydent Miasta",
  contact: "Magdalena Karwat · mkarwat@um.zabrze.pl",
  deadline: "2026-10-12 09:00",
  opening: "2026-10-12 09:30",
  bindingUntil: "2027-02-08 23:59",
  duration: "36 miesięcy od faktycznego rozpoczęcia, albo do wyczerpania środków",
  cpv: "90533000-2",
  deposit: "4 000 000 PLN",
  criteria: "Cena 70% · Poziom Recyklingu 30%",
  source: "Oficjalna platforma Logintrade + treść ogłoszenia TED/źródła agregujące",
  sourceUrl: "https://zabrze.logintrade.net/zapytania_email,238598,f66e29363d9dcf5e140c48eece63b78c.html",
  documentStatus: "Ogłoszenie dostępne publicznie. Pliki SWZ/OPZ/PPU/XLS/ZIP są wykazane na platformie, ale ich pełna treść nie została w tej iteracji bezpośrednio odczytana."
} as const;

export const documents = [
  ["01","JEDZ.xml","139.08 KB","listed"],
  ["02","ogłoszenie o zamówieniu.pdf","224.66 KB","readable"],
  ["03","Oświadczenie o elektromobilności","30.89 KB","listed"],
  ["04","Specyfikacja Warunków Zamówienia.doc","484.86 KB","verification"],
  ["05","Załącznik nr 1 do SWZ · OPZ","707.07 KB","verification"],
  ["06","Załącznik nr 2 do SWZ · PPU","322.05 KB","verification"],
  ["07","Załącznik nr 2a · RODO","251.39 KB","verification"],
  ["08","Załącznik nr 5 · KALKULACJA CENY.xls","92.16 KB","verification"],
  ["09","Załączniki do OPZ.zip","12.74 MB","verification"]
] as const;

export const requirements: Requirement[] = [
  {id:"REQ-01",area:"Procedura",requirement:"Przetarg nieograniczony, zamówienie unijne; art. 132 Pzp wskazany w ogłoszeniu.",evidence:"Ogłoszenie / sekcja Procedura",status:"CONFIRMED",impact:"Wymaga pełnej dyscypliny dokumentowej i terminowej.",action:"Zamknąć checklistę formalną przed wysyłką."},
  {id:"REQ-02",area:"Termin",requirement:"Oferta do 12.10.2026, 09:00; otwarcie 09:30.",evidence:"Logintrade + ogłoszenie",status:"CONFIRMED",impact:"Krytyczny deadline operacyjny.",action:"Ustawić wewnętrzny deadline co najmniej 24 h wcześniej."},
  {id:"REQ-03",area:"Wadium",requirement:"Wadium 4 000 000 PLN, przed terminem składania ofert.",evidence:"Ogłoszenie / wymagania wadium",status:"CONFIRMED",impact:"Duże zaangażowanie kapitału lub limitu gwarancyjnego.",action:"Potwierdzić formę, rachunek, treść gwarancji i procedurę zwrotu w SWZ."},
  {id:"REQ-04",area:"Oferta",requirement:"Oferta elektroniczna z kwalifikowanym podpisem, wyłącznie przez platformę zakupową.",evidence:"Ogłoszenie / informacja o składaniu",status:"CONFIRMED",impact:"Ryzyko techniczne i formalne przy submission.",action:"Wykonać próbę techniczną i checklistę podpisów."},
  {id:"REQ-05",area:"Realizacja",requirement:"Podstawowy zakres: 36 miesięcy od faktycznego rozpoczęcia albo do wyczerpania środków.",evidence:"Ogłoszenie / opis terminu",status:"CONFIRMED",impact:"Wpływa na model floty, ludzi, finansowanie i amortyzację.",action:"Zbudować model kosztowy dla pełnego okresu oraz scenariusza późniejszego startu."},
  {id:"REQ-06",area:"Ocena",requirement:"Cena 70 pkt, Poziom Recyklingu 30 pkt.",evidence:"Ogłoszenie / kryteria udzielenia",status:"CONFIRMED",impact:"Strategia ceny jest powiązana z deklarowanym poziomem recyklingu.",action:"Policzyć krzywą koszt jakości vs punkty."},
  {id:"REQ-07",area:"Recykling",requirement:"Ogłoszenie opisuje poziomy deklaracji 33%, 40%, 45%, 50% oraz poziom wymagany prawem, z punktacją 0/10/15/20/30.",evidence:"Treść ogłoszenia TED",status:"CONFIRMED",impact:"Każdy dodatkowy poziom może zmienić koszt zagospodarowania i ryzyko kar.",action:"Zweryfikować metodę kalkulacji i odpowiedzialność w §15 ust.7 PPU."},
  {id:"REQ-08",area:"Recykling",requirement:"Poziom 33% jest wskazany jako minimum w kryterium; zamawiający odwołuje się do danych historycznych 2023–2025.",evidence:"Treść ogłoszenia TED",status:"CONFIRMED",impact:"Historyczne dane nie zastępują danych wolumenowych dla przyszłego kontraktu.",action:"Pozyskać dane wejściowe i definicję miernika z OPZ/PPU."},
  {id:"REQ-09",area:"Opcje",requirement:"Opcja obejmuje odpady budowlane i rozbiórkowe z gospodarstw domowych, odkup pojemników oraz zwiększenie wartości do 20% wartości brutto zamówienia podstawowego.",evidence:"Ogłoszenie / opis opcji",status:"CONFIRMED",impact:"Tworzy dodatkową ekspozycję kosztową i logistyczną.",action:"Oddzielnie modelować każdą opcję i jej prawdopodobieństwo."},
  {id:"REQ-10",area:"Opcje",requirement:"Wartość opcji przy kalkulacji opiera się na cenach jednostkowych oferty; rozliczenie ma uwzględniać waloryzację.",evidence:"Ogłoszenie / opis opcji",status:"CONFIRMED",impact:"Ceny jednostkowe muszą być odporne na rozszerzenie zakresu.",action:"Sprawdzić mechanizm waloryzacji w PPU."},
  {id:"REQ-11",area:"CPV / zakres",requirement:"Zakres obejmuje m.in. odbiór, transport, przetwarzanie/usuwanie, recykling i pojemniki.",evidence:"Ogłoszenie",status:"CONFIRMED",impact:"Koszt jest wieloskładnikowy, nie tylko transportowy.",action:"Zbudować cost-driver map per strumień usługi."},
  {id:"REQ-12",area:"Warunki udziału",requirement:"Dokładne doświadczenie, zasoby techniczne i pozostałe warunki wymagają odczytu SWZ; ogłoszenie odsyła do dokumentacji.",evidence:"Logintrade: SWZ + JEDZ dostępne jako załączniki",status:"REQUIRES_VERIFICATION",impact:"Możliwa eliminacja formalna przed oceną ceny.",action:"Odczytać SWZ i zmapować każdy warunek na dowód."},
  {id:"REQ-13",area:"OPZ",requirement:"Szczegółowy zakres usług, frakcje, częstotliwości, adresy/obszary, pojemniki i procedury są w Części III SWZ.",evidence:"Logintrade / OPZ",status:"REQUIRES_VERIFICATION",impact:"Największa niewiadoma kosztowa.",action:"Wykonać pełną ekstrakcję OPZ i tabelaryzację ilości."},
  {id:"REQ-14",area:"PPU",requirement:"Odpowiedzialność za poziom recyklingu wskazana jest w §15 ust.7 PPU.",evidence:"Ogłoszenie odsyła do PPU",status:"PARTIAL",impact:"Potencjalne kary/ryzyko ekonomiczne.",action:"Odczytać §15 ust.7 i wszystkie postanowienia sankcyjne."},
  {id:"REQ-15",area:"Kalkulacja",requirement:"Kalkulacja ceny jest osobnym załącznikiem XLS.",evidence:"Logintrade / Załącznik nr 5",status:"REQUIRES_VERIFICATION",impact:"Nieznana struktura pozycji cenowych ogranicza poprawność modelu.",action:"Zmapować każdą pozycję XLS do OPZ i PPU."},
  {id:"REQ-16",area:"OPZ attachments",requirement:"ZIP 12.74 MB zawiera dodatkowe dane do OPZ.",evidence:"Logintrade",status:"REQUIRES_VERIFICATION",impact:"Ukryte wolumeny, trasy, mapy lub tabele mogą determinować cenę.",action:"Rozpakować, zindeksować i cross-checkować z OPZ/XLS."},
  {id:"REQ-17",area:"Elektromobilność",requirement:"Zamawiający udostępnia odrębne oświadczenie dotyczące elektromobilności.",evidence:"Logintrade / załącznik nr 2 do umowy",status:"REQUIRES_VERIFICATION",impact:"Może zmienić strukturę floty i CAPEX/OPEX.",action:"Zweryfikować minimalne udziały, terminy i sposób potwierdzenia."},
  {id:"REQ-18",area:"Submission",requirement:"Dokumenty są po polsku; oferta ma być złożona przez platformę.",evidence:"Ogłoszenie",status:"CONFIRMED",impact:"Wymaga kontroli kompletności, podpisów i zgodności formatów.",action:"Przygotować submission checklist z właścicielem każdego dokumentu."}
];

export const questions: BuyerQuestion[] = [
  {id:"Q-P1-01",priority:"P1",area:"OPZ / wolumeny",issue:"Brak bezpośrednio odczytanych tabel ilościowych z OPZ/XLS w aktualnej analizie.",rationale:"Bez jednoznacznych wolumenów per frakcja, nieruchomość/segment i okres nie da się obronić kalkulacji.",pricingImpact:"Bardzo wysoki",question:"Prosimy o potwierdzenie aktualnych, bazowych wolumenów odpadów w podziale na wszystkie frakcje objęte zamówieniem, z rozbiciem na lata/okresy, oraz wskazanie, które wartości należy przyjąć jako wiążące do kalkulacji ceny.",evidence:"OPZ + Kalkulacja ceny — wymagają bezpośredniej weryfikacji"},
  {id:"Q-P1-02",priority:"P1",area:"XLS ↔ OPZ",issue:"Niezweryfikowana relacja pozycji kalkulacji ceny do jednostek i zakresów OPZ.",rationale:"Niejasna jednostka lub sposób agregacji może prowadzić do nieporównywalnych ofert.",pricingImpact:"Bardzo wysoki",question:"Prosimy o potwierdzenie, dla każdej pozycji Kalkulacji Ceny, jednostki rozliczeniowej, zakresu świadczenia oraz źródła ilości przyjętej przez Zamawiającego do wyliczenia wartości pozycji.",evidence:"Załącznik nr 5 XLS — wymaga odczytu"},
  {id:"Q-P1-03",priority:"P1",area:"Recykling / PPU",issue:"Kryterium 30% wiąże się z odpowiedzialnością wykonawcy wskazaną w §15 ust.7 PPU.",rationale:"Premia punktowa może generować dodatkowy koszt i ryzyko sankcji.",pricingImpact:"Bardzo wysoki",question:"Prosimy o jednoznaczne wskazanie sposobu wyliczenia poziomu przygotowania do ponownego użycia i recyklingu dla celów kryterium oraz rozliczenia umowy, źródeł danych, okresów pomiarowych i skutków niewykonania zadeklarowanego poziomu.",evidence:"Ogłoszenie: kryterium 30% + §15 ust.7 PPU"},
  {id:"Q-P1-04",priority:"P1",area:"Start realizacji",issue:"Podstawowy okres liczony jest od faktycznego rozpoczęcia usługi, a nie z prostą datą kalendarzową.",rationale:"Start determinuje koszty mobilizacji, zatrudnienia, floty i amortyzacji.",pricingImpact:"Wysoki",question:"Prosimy o wskazanie planowanej daty rozpoczęcia realizacji oraz maksymalnego okresu pomiędzy zawarciem umowy a faktycznym rozpoczęciem usługi, wraz z obowiązkami wykonawcy w tym okresie.",evidence:"Ogłoszenie / termin realizacji"},
  {id:"Q-P1-05",priority:"P1",area:"Elektromobilność",issue:"Odrębny załącznik dotyczący elektromobilności został udostępniony, ale nie odczytano jego treści.",rationale:"Wymóg flotowy może wymagać CAPEX przed startem.",pricingImpact:"Wysoki",question:"Prosimy o potwierdzenie minimalnej liczby/udziału pojazdów objętych wymaganiami elektromobilności, terminów ich spełnienia oraz sposobu dokumentowania zgodności w całym okresie realizacji.",evidence:"Załącznik nr 2 do umowy — wymaga odczytu"},
  {id:"Q-P1-06",priority:"P1",area:"Opcja 20%",issue:"Opcja zwiększenia wartości do 20% oraz inne opcje wpływają na konstrukcję cen jednostkowych.",rationale:"Opcje mogą być uruchamiane częściowo i w różnym czasie.",pricingImpact:"Wysoki",question:"Prosimy o potwierdzenie przewidywanego sposobu i terminu uruchamiania poszczególnych praw opcji oraz czy Zamawiający może uruchamiać je wielokrotnie i częściowo, a także jak będą przekazywane prognozy wolumenów.",evidence:"Ogłoszenie / opis opcji"},
  {id:"Q-P2-01",priority:"P2",area:"Pojemniki",issue:"Opcja obejmuje odkup pojemników od wykonawcy.",rationale:"Wartość rezydualna i odpowiedzialność za stan pojemników mogą zmienić ekonomię modelu.",pricingImpact:"Średni/Wysoki",question:"Prosimy o potwierdzenie katalogu pojemników objętych ewentualnym odkupem, kryteriów stanu technicznego oraz zasad ustalania ilości i ceny odkupu.",evidence:"Ogłoszenie odsyła do OPZ/PPU"},
  {id:"Q-P2-02",priority:"P2",area:"Waloryzacja",issue:"Opcja rozliczana jest według cen jednostkowych z uwzględnieniem waloryzacji.",rationale:"Trzeba znać indeks, bazę, częstotliwość i limity waloryzacji.",pricingImpact:"Średni/Wysoki",question:"Prosimy o wskazanie pełnego mechanizmu waloryzacji cen jednostkowych, w tym wskaźników, miesiąca bazowego, częstotliwości, progów, limitów oraz zasad stosowania waloryzacji do poszczególnych kosztów.",evidence:"Ogłoszenie + PPU — wymaga odczytu PPU"},
  {id:"Q-P2-03",priority:"P2",area:"Kary / SLA",issue:"Niezweryfikowany katalog kar i przypadków nienależytego wykonania.",rationale:"Kary mogą być istotnym elementem ceny ryzyka.",pricingImpact:"Średni/Wysoki",question:"Prosimy o potwierdzenie pełnego katalogu kar umownych, podstaw ich naliczania, limitów łącznych oraz relacji kar do odszkodowania uzupełniającego.",evidence:"PPU — wymaga bezpośredniego odczytu"},
  {id:"Q-P2-04",priority:"P2",area:"PSZOK / odpady problemowe",issue:"Zakresy szczegółowe wymagają OPZ/załączników.",rationale:"Dodatkowe strumienie i miejsca obsługi mogą tworzyć koszt stały lub zmienny.",pricingImpact:"Średni/Wysoki",question:"Prosimy o jednoznaczne wskazanie wszystkich punktów, lokalizacji i strumieni odpadów, za które wykonawca odpowiada w ramach ceny podstawowej, oraz tych objętych opcją.",evidence:"OPZ + ZIP — wymaga odczytu"},
  {id:"Q-P3-01",priority:"P3",area:"Raportowanie",issue:"Niezweryfikowany zakres raportów, danych GPS, wag i terminów przekazywania.",rationale:"Koszty IT i administracji mogą być pomijalne albo znaczące zależnie od wymagań.",pricingImpact:"Średni",question:"Prosimy o potwierdzenie wszystkich obowiązków raportowych, wymaganych systemów/interfejsów, częstotliwości przekazywania danych oraz odpowiedzialności za koszty integracji.",evidence:"OPZ/PPU — wymaga odczytu"},
  {id:"Q-P3-02",priority:"P3",area:"Zmiany zakresu",issue:"Niezweryfikowane zasady zmian liczby nieruchomości, częstotliwości i tras.",rationale:"Dynamiczna zmiana zakresu może wpływać na routing i zasoby.",pricingImpact:"Średni",question:"Prosimy o wskazanie zasad aktualizacji danych o nieruchomościach, harmonogramach i trasach oraz minimalnego wyprzedzenia, z jakim Zamawiający będzie przekazywał zmiany.",evidence:"OPZ/PPU — wymaga odczytu"}
];


export type AnalysisStage = {
  id: string;
  title: string;
  why: string;
  evidence: string;
  question: string;
  impact: string;
};

export const analysisStages: AnalysisStage[] = [
  {id:"01",title:"1. Zamknąć zakres świadczenia",why:"Najpierw trzeba wiedzieć dokładnie, co wykonawca ma odebrać, skąd, jak często, czym i gdzie zagospodarować.",evidence:"OPZ + załączniki ZIP",question:"Czy wszystkie frakcje, lokalizacje, częstotliwości, pojemniki i obowiązki są jednoznacznie zdefiniowane i przypisane do ceny podstawowej?",impact:"Bardzo wysoki — zakres jest bazą całej kalkulacji."},
  {id:"02",title:"2. Ustalić wolumeny i jednostki",why:"Nie wolno budować ceny na samym opisie usługi. Każdy koszt musi mieć driver: Mg, szt., kurs, km, pojemnik, gospodarstwo, trasa lub okres.",evidence:"XLS + OPZ + dane historyczne",question:"Które ilości są wiążące do kalkulacji i jaką jednostkę rozliczeniową należy przyjąć dla każdej pozycji?",impact:"Krytyczny — błędny wolumen może wypaczyć cenę całego kontraktu."},
  {id:"03",title:"3. Zbudować model operacyjny",why:"Po wolumenach trzeba odtworzyć routing, liczbę ekip, pojazdy, zmiany, zaplecze, instalacje i moce przerobowe.",evidence:"OPZ + harmonogramy + wymagania techniczne",question:"Jakie są minimalne częstotliwości, czasy reakcji, wymagania sprzętowe i zasady zmian tras?",impact:"Bardzo wysoki — determinuje CAPEX/OPEX."},
  {id:"04",title:"4. Polićzyć recykling jako koszt i punkty",why:"Recykling jest jednocześnie kryterium oceny i potencjalnym źródłem kosztu oraz ryzyka kontraktowego.",evidence:"Ogłoszenie + PPU + OPZ",question:"Jaki dokładnie algorytm mierzy poziom recyklingu i jakie są konsekwencje niewykonania zadeklarowanego poziomu?",impact:"Krytyczny — 30% oceny nie powinno być analizowane w oderwaniu od ekonomiki."},
  {id:"05",title:"5. Przejrzeć PPU jak umowę ryzyka",why:"Cena bez kosztu ryzyka jest pozorna. Trzeba policzyć kary, SLA, waloryzację, odpowiedzialność i jednostronne mechanizmy zmian.",evidence:"PPU",question:"Jakie zdarzenia generują kary, jakie są limity, terminy, mechanizmy waloryzacji i możliwości zmian zakresu?",impact:"Bardzo wysoki — ryzyko musi zostać wycenione."},
  {id:"06",title:"6. Zbudować warianty cenowe",why:"Przy cenie 70% i recyklingu 30% należy policzyć kilka strategii, zamiast wybierać cenę intuicyjnie.",evidence:"XLS + kryteria + model kosztowy",question:"Jaki poziom recyklingu daje najlepszą relację punktów do dodatkowego kosztu i ryzyka?",impact:"Krytyczny — decyzja powinna wynikać z modelu, nie z narracji."},
  {id:"07",title:"7. Przejść formalny gate",why:"Dopiero po zamknięciu ekonomii należy sprawdzić JEDZ, doświadczenie, zasoby, podpisy, wadium i submission.",evidence:"SWZ + JEDZ + platforma",question:"Czy każdy warunek udziału ma przypisany dokument, właściciela i termin dostarczenia?",impact:"Krytyczny — błąd formalny może wyeliminować ofertę niezależnie od ceny."}
];

export const fccEvidence = [
  {title:"Lokalna baza w Zabrzu",text:"FCC Śląsk podaje adres przy ul. Lecha 10 w Zabrzu i deklaruje obsługę gospodarki odpadami na Górnym Śląsku, w tym Zabrza.",source:"Oficjalna strona FCC Śląsk",kind:"FAKT"},
  {title:"Istniejący PSZOK w Zabrzu",text:"FCC Śląsk prowadzi PSZOK przy ul. Cmentarnej 19F w Zabrzu. To może być istotnym atutem operacyjnym, jeżeli zakres nowego zamówienia wykorzystuje podobną infrastrukturę.",source:"FCC + regulamin PSZOK",kind:"FAKT"},
  {title:"Doświadczenie lokalne",text:"W 2026 r. publicznie odnotowano udzielenie FCC Śląsk zamówienia Miasta Zabrze na organizację i prowadzenie PSZOK o wartości 15 310 333 PLN.",source:"Dane o zamówieniach publicznych",kind:"FAKT"},
  {title:"Doświadczenie w lokalnych usługach odpadowych",text:"FCC Polska realizowało także usługę wywozu odpadów dla ZUS Oddział w Zabrzu; umowę 24-miesięczną zakończono w czerwcu 2026 r. zgodnie z terminem.",source:"e-Zamówienia",kind:"FAKT"},
  {title:"Hipoteza przewagi do sprawdzenia",text:"Jeżeli OPZ wymaga zasobów, infrastruktury i logistyki dostępnych już lokalnie, FCC może mieć możliwość ograniczenia kosztów mobilizacji i ryzyka startu. To hipoteza ekonomiczna, nie dowód przewagi w tym postępowaniu.",source:"Wniosek analityczny Core Engine",kind:"HIPOTEZA"},
  {title:"Warunek ceny",text:"Lokalność sama nie wystarczy. Przy kryteriach Cena 70% + Recykling 30% przewaga musi zostać potwierdzona modelem kosztowym, zdolnością do osiągnięcia deklarowanego poziomu recyklingu i zgodnością formalną.",source:"Ogłoszenie postępowania",kind:"KRYTERIUM"}
];

export const strategicChecks = [
  "Czy FCC ma już zasoby, które można przypisać do tego kontraktu bez istotnego CAPEX?",
  "Czy istniejąca infrastruktura w Zabrzu może obsłużyć wymagane wolumeny i frakcje?",
  "Czy aktualny model PSZOK i zaplecza może obniżyć koszt mobilizacji?",
  "Czy lokalna flota spełnia wymagania elektromobilności bez dodatkowych inwestycji?",
  "Czy FCC może osiągnąć 40/45/50% recyklingu przy koszcie niższym niż wartość dodatkowych punktów?",
  "Czy ceny jednostkowe są odporne na opcję +20% i inne warianty zakresu?",
  "Czy PPU nie przenosi na wykonawcę ryzyka, którego nie widać w samym ogłoszeniu?",
  "Czy każdy warunek udziału ma dziś potwierdzony dowód i właściciela?"
];
