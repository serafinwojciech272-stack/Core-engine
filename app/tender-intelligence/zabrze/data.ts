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
  {id:"Q-P1-01",priority:"OPZ / wolumeny",area:"Brak bezpośrednio odczytanych tabel ilościowych",issue:"Bez wolumenów per frakcja i okres nie da się obronić kalkulacji.",rationale:"Bardzo wysoki",pricingImpact:"Potwierdzić bazowe wolumeny wszystkich frakcji, okresy i wartości wiążące do kalkulacji.",question:"OPZ + XLS — weryfikacja",evidence:"undefined"},
  {id:"Q-P1-02",priority:"XLS ↔ OPZ",area:"Jednostki rozliczeniowe",issue:"Błędna jednostka może zmienić porównywalność ofert.",rationale:"Bardzo wysoki",pricingImpact:"Dla każdej pozycji XLS potwierdzić jednostkę, zakres, ilość i źródło ilości.",question:"XLS — weryfikacja",evidence:"undefined"},
  {id:"Q-P1-03",priority:"Recykling / PPU",area:"Mechanizm 30% kryterium",issue:"Punkty mogą wymagać kosztownego poziomu wykonania.",rationale:"Bardzo wysoki",pricingImpact:"Potwierdzić algorytm wyliczenia poziomu recyklingu, dane wejściowe, okresy pomiaru i skutki niewykonania deklaracji.",question:"Ogłoszenie + PPU",evidence:"undefined"},
  {id:"Q-P1-04",priority:"Start realizacji",area:"Faktyczny start usługi",issue:"Mobilizacja zależy od rzeczywistej daty rozpoczęcia.",rationale:"Wysoki",pricingImpact:"Wskazać planowaną datę startu i maksymalny odstęp od zawarcia umowy do rozpoczęcia świadczenia.",question:"Ogłoszenie / SWZ",evidence:"undefined"},
  {id:"Q-P1-05",priority:"Flota / elektromobilność",area:"Minimalne wymagania floty",issue:"Może wymagać CAPEX przed startem.",rationale:"Bardzo wysoki",pricingImpact:"Potwierdzić liczbę, typy, parametry i wymagany udział pojazdów oraz terminy spełnienia wymagań elektromobilności.",question:"Oświadczenie + OPZ",evidence:"undefined"},
  {id:"Q-P1-06",priority:"Opcja +20%",area:"Zakres zwiększenia zamówienia",issue:"Cena jednostkowa musi pozostać ekonomiczna przy rozszerzeniu.",rationale:"Wysoki",pricingImpact:"Potwierdzić dokładny mechanizm uruchamiania opcji, limit 20%, okres i zasady rozliczenia każdej pozycji.",question:"Ogłoszenie + PPU",evidence:"undefined"},
  {id:"Q-P1-07",priority:"Pojemniki",area:"Stan, własność i wymiana",issue:"Koszt pojemników może być istotnym składnikiem CAPEX/OPEX.",rationale:"Wysoki",pricingImpact:"Potwierdzić liczbę, typy, pojemności, własność, stan, wymianę i odpowiedzialność za uszkodzenia.",question:"OPZ + XLS",evidence:"undefined"},
  {id:"Q-P1-08",priority:"Trasy",area:"Routing i częstotliwości",issue:"Liczba kursów i kilometrów determinuje koszt paliwa, pracy i floty.",rationale:"Bardzo wysoki",pricingImpact:"Potwierdzić częstotliwości, ograniczenia czasowe, rejony i dane niezbędne do wyznaczenia tras.",question:"OPZ + ZIP",evidence:"undefined"},
  {id:"Q-P1-09",priority:"Zagospodarowanie",area:"Instalacje i miejsca przekazania",issue:"Koszt zależy od realnej ścieżki zagospodarowania.",rationale:"Bardzo wysoki",pricingImpact:"Wskazać wymagane instalacje, dopuszczalne miejsca przekazania i zasady zmiany instalacji.",question:"OPZ + PPU",evidence:"undefined"},
  {id:"Q-P1-10",priority:"Kary / SLA",area:"Pełny katalog sankcji",issue:"Kary muszą być uwzględnione w kosztach ryzyka.",rationale:"Bardzo wysoki",pricingImpact:"Potwierdzić wszystkie kary, podstawy naliczenia, limity, kumulację i możliwość potrąceń.",question:"PPU",evidence:"undefined"},
  {id:"Q-P1-11",priority:"Waloryzacja",area:"Zakres i moment waloryzacji",issue:"Nieznany mechanizm może przenieść inflację na wykonawcę.",rationale:"Wysoki",pricingImpact:"Potwierdzić wskaźnik, próg, częstotliwość, limit i koszty objęte waloryzacją.",question:"PPU",evidence:"undefined"},
  {id:"Q-P1-12",priority:"Odpady budowlane",area:"Opcjonalny strumień z gospodarstw",issue:"Opcja może wymagać dodatkowych pojazdów, worków i obsługi.",rationale:"Wysoki",pricingImpact:"Potwierdzić wolumen, częstotliwość, sposób zamawiania BIG-BAG i rozliczenie usługi opcjonalnej.",question:"OPZ + opis opcji",evidence:"undefined"},
  {id:"Q-P1-13",priority:"Dane historyczne",area:"Różnica między historią a prognozą",issue:"Dane historyczne nie muszą odzwierciedlać przyszłych wolumenów.",rationale:"Wysoki",pricingImpact:"Udostępnić dane historyczne użyte do konstrukcji wymagań wraz z metodą prognozowania wolumenów.",question:"Ogłoszenie + OPZ",evidence:"undefined"},
  {id:"Q-P1-14",priority:"Zabudowa",area:"Jedno- vs wielorodzinna",issue:"Różne profile generacji zmieniają routing i częstotliwości.",rationale:"Wysoki",pricingImpact:"Potwierdzić liczbę punktów adresowych i udział zabudowy jedno- i wielorodzinnej.",question:"OPZ / ZIP",evidence:"undefined"},
  {id:"Q-P1-15",priority:"Sezonowość",area:"Wahania wolumenów",issue:"Sezonowe piki wpływają na rezerwy floty i załóg.",rationale:"Wysoki",pricingImpact:"Wskazać historyczne miesięczne wolumeny i oczekiwane sezonowe odchylenia.",question:"OPZ / dane historyczne",evidence:"undefined"},
  {id:"Q-P2-16",priority:"Harmonogram",area:"Zmiany harmonogramów",issue:"Zmiany mogą generować dodatkowe kursy.",rationale:"Średni",pricingImpact:"Potwierdzić zasady zmiany harmonogramu i minimalny termin powiadomienia wykonawcy.",question:"OPZ / PPU",evidence:"undefined"},
  {id:"Q-P2-17",priority:"Reklamacje",area:"Obsługa zgłoszeń mieszkańców",issue:"SLA reklamacyjne może wymagać dedykowanej obsługi.",rationale:"Średni",pricingImpact:"Potwierdzić kanały, terminy reakcji, dokumentowanie i konsekwencje przekroczenia SLA.",question:"OPZ / PPU",evidence:"undefined"},
  {id:"Q-P2-18",priority:"Kontrola",area:"Dowody wykonania usługi",issue:"Brak dowodu może generować spory i kary.",rationale:"Średni",pricingImpact:"Potwierdzić wymagany system GPS, zdjęcia, RFID, raporty i retencję danych.",question:"OPZ / PPU",evidence:"undefined"},
  {id:"Q-P2-19",priority:"GPS",area:"Zakres monitoringu",issue:"Monitoring może wymagać inwestycji w telematykę.",rationale:"Średni",pricingImpact:"Wskazać minimalny zakres danych GPS i sposób udostępniania Zamawiającemu.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P2-20",priority:"Mieszkańcy",area:"Obsługa informacyjna",issue:"Obowiązki komunikacyjne mogą zwiększać OPEX.",rationale:"Średni",pricingImpact:"Potwierdzić zakres materiałów informacyjnych, kanały komunikacji i odpowiedzialność wykonawcy.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P2-21",priority:"Punkt obsługi",area:"Obsługa mieszkańca",issue:"Stały punkt może wymagać lokalu i personelu.",rationale:"Średni",pricingImpact:"Potwierdzić wymagania dotyczące punktu obsługi, godzin, lokalizacji i wyposażenia.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P2-22",priority:"PSZOK",area:"Relacja PSZOK do zakresu głównego",issue:"Zakres PSZOK może zmienić model operacyjny.",rationale:"Wysoki",pricingImpact:"Potwierdzić, które obowiązki PSZOK są częścią zamówienia, a które pozostają poza nim.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P2-23",priority:"Podwykonawcy",area:"Dopuszczalny model realizacji",issue:"Ograniczenia podwykonawstwa wpływają na strukturę kosztów.",rationale:"Średni",pricingImpact:"Potwierdzić zakres dopuszczalnego podwykonawstwa i obowiązki zgłoszeniowe.",question:"SWZ / PPU",evidence:"undefined"},
  {id:"Q-P2-24",priority:"Pracownicy",area:"Wymogi zatrudnienia",issue:"Wymogi pracownicze wpływają na koszt stały.",rationale:"Średni",pricingImpact:"Potwierdzić stanowiska objęte obowiązkiem zatrudnienia na umowę o pracę i sposób kontroli.",question:"SWZ / PPU",evidence:"undefined"},
  {id:"Q-P2-25",priority:"Odpowiedzialność",area:"Uszkodzenia pojemników i mienia",issue:"Niejasny podział odpowiedzialności tworzy koszt roszczeń.",rationale:"Średni",pricingImpact:"Potwierdzić zasady odpowiedzialności za uszkodzenia, zagubienie i naturalne zużycie.",question:"PPU",evidence:"undefined"},
  {id:"Q-P2-26",priority:"Odpady niezgodne",area:"Zanieczyszczenie frakcji",issue:"Może podnosić koszt zagospodarowania i obniżać recykling.",rationale:"Wysoki",pricingImpact:"Potwierdzić procedurę postępowania z odpadami niezgodnymi z deklarowaną frakcją.",question:"OPZ / PPU",evidence:"undefined"},
  {id:"Q-P2-27",priority:"Ważenie",area:"Masa odpadu",issue:"Sposób ważenia wpływa na rozliczenia.",rationale:"Wysoki",pricingImpact:"Potwierdzić miejsce, urządzenia, legalizację, moment ważenia i sposób rozstrzygania różnic.",question:"OPZ / PPU",evidence:"undefined"},
  {id:"Q-P2-28",priority:"Transport",area:"Przejazdy do instalacji",issue:"Dystans do instalacji jest kluczowym cost driverem.",rationale:"Wysoki",pricingImpact:"Potwierdzić wymagane miejsca zagospodarowania oraz zasady zmiany trasy do instalacji.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P3-29",priority:"Raportowanie",area:"Format raportów",issue:"Nadmiar ręcznego raportowania zwiększa koszt administracji.",rationale:"Niski",pricingImpact:"Potwierdzić format, częstotliwość i automatyzację raportów.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P3-30",priority:"Kontakt",area:"Kanał komunikacji operacyjnej",issue:"Brak jednego kanału może powodować błędy.",rationale:"Niski",pricingImpact:"Potwierdzić kanał zgłoszeń operacyjnych i osobę/rolę po stronie Zamawiającego.",question:"PPU",evidence:"undefined"},
  {id:"Q-P3-31",priority:"Święta",area:"Dni wolne i harmonogram",issue:"Nietypowe harmonogramy mogą zwiększyć koszty pracy.",rationale:"Średni",pricingImpact:"Potwierdzić zasady realizacji odbiorów w dni ustawowo wolne i rekompensaty.",question:"OPZ",evidence:"undefined"},
  {id:"Q-P3-32",priority:"Awaria",area:"Procedura awaryjna",issue:"Rezerwa sprzętowa wpływa na koszt.",rationale:"Średni",pricingImpact:"Potwierdzić wymagany czas podstawienia pojazdu zastępczego i minimalny poziom rezerwy.",question:"OPZ / PPU",evidence:"undefined"},
  {id:"Q-P3-33",priority:"Zdarzenia nadzwyczajne",area:"Nagły wzrost ilości odpadów",issue:"Brak mechanizmu może generować niekontrolowane OPEX.",rationale:"Średni",pricingImpact:"Potwierdzić procedurę dla nadzwyczajnego wzrostu wolumenu lub zdarzeń masowych.",question:"PPU",evidence:"undefined"},
  {id:"Q-P3-34",priority:"Dane",area:"RODO i dane mieszkańców",issue:"Obowiązki przetwarzania danych mogą wymagać procesów i zabezpieczeń.",rationale:"Średni",pricingImpact:"Potwierdzić zakres danych osobowych i role administratora/podmiotu przetwarzającego.",question:"Załącznik 2a",evidence:"undefined"},
  {id:"Q-P3-35",priority:"Wadium",area:"Forma i zwrot",issue:"Błąd formalny przy wadium może wyeliminować ofertę.",rationale:"Wysoki",pricingImpact:"Potwierdzić wszystkie dopuszczalne formy, treść gwarancji i terminy zwrotu.",question:"SWZ",evidence:"undefined"},
  {id:"Q-P3-36",priority:"Podpis",area:"Podpisy elektroniczne",issue:"Brak właściwego podpisu może unieważnić submission.",rationale:"Wysoki",pricingImpact:"Potwierdzić wymagane rodzaje podpisów dla każdego dokumentu i pełnomocnictwa.",question:"SWZ / platforma",evidence:"undefined"},
  {id:"Q-P3-37",priority:"JEDZ",area:"Zakres i aktualność oświadczeń",issue:"Błąd w JEDZ może stworzyć ryzyko formalne.",rationale:"Wysoki",pricingImpact:"Przejść JEDZ pole po polu i przypisać właściciela danych oraz dowód.",question:"JEDZ + SWZ",evidence:"undefined"},
  {id:"Q-P3-38",priority:"Pełnomocnictwa",area:"Reprezentacja wykonawcy",issue:"Brak dokumentu może zatrzymać ofertę.",rationale:"Wysoki",pricingImpact:"Potwierdzić wymagane pełnomocnictwa i sposób ich podpisania.",question:"SWZ",evidence:"undefined"},
  {id:"Q-P3-39",priority:"Konsorcjum",area:"Model wspólnego ubiegania",issue:"Podział zasobów i odpowiedzialności musi być formalnie spójny.",rationale:"Średni",pricingImpact:"Potwierdzić wymagania dla konsorcjum, jeśli FCC rozważa model wspólny.",question:"SWZ",evidence:"undefined"},
  {id:"Q-P3-40",priority:"Ceny jednostkowe",area:"Odporność cen na opcje",issue:"Niska cena jednostkowa może stać się ryzykiem przy zwiększeniu zakresu.",rationale:"Wysoki",pricingImpact:"Potwierdzić, które pozycje są podstawą opcji i jak działa ich waloryzacja.",question:"XLS + PPU",evidence:"undefined"}
];

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


export const competitorEvidence = [
  {name:"PreZero Service Południe",type:"PUNKT ODNIESIENIA",text:"W poprzednim postępowaniu dotyczącym odbioru odpadów w Zabrzu oferta PreZero została wybrana jako korzystniejsza finansowo; Miasto wskazywało różnicę ponad 13 mln zł względem konkurencji.",source:"Miasto Zabrze, 30.03.2025",implication:"FCC musi przede wszystkim kontrolować koszt całkowity i założenia wolumenowe."},
  {name:"WPO Alba + FCC Śląsk",type:"HISTORIA KONKURENCJI",text:"W poprzednim postępowaniu konsorcjum WPO Alba i FCC Śląsk odwołało się od wyboru PreZero; Miasto podało, że KIO oddaliła odwołanie.",source:"Miasto Zabrze, 30.03.2025",implication:"Poprzedni przetarg pokazuje, że różnica cenowa i formalna jakość oferty są kluczowe."},
  {name:"FCC Śląsk",type:"LOKALNA BAZA",text:"FCC Śląsk jest wykonawcą prowadzącym PSZOK w Zabrzu przy ul. Cmentarnej 19F i działa z adresem przy ul. Lecha 10.",source:"Regulamin PSZOK Miasta Zabrze 2026",implication:"Potencjalnie niższy koszt mobilizacji i znajomość lokalnego systemu — do udowodnienia modelem."},
  {name:"FCC Polska + FCC Śląsk",type:"AKTYWNOŚĆ RYNKOWA",text:"W 2026 r. FCC Polska i FCC Śląsk występowały wspólnie w lokalnych zamówieniach; osobno FCC Śląsk uzyskał zamówienie na organizację i prowadzenie PSZOK w Zabrzu o wartości 15 310 333 zł.",source:"e-Zamówienia / dane o udzielonych zamówieniach",implication:"Doświadczenie lokalne może skrócić czas mobilizacji, ale nie zastępuje kalkulacji kosztowej."},
  {name:"Remondis",type:"POTENCJALNY KONKURENT",text:"Remondis jest aktywnym wykonawcą usług odpadowych w regionie; w 2026 r. występował przeciwko FCC w innych zamówieniach śląskich.",source:"dane zamówień publicznych 2026",implication:"Porównać lokalną bazę, flotę, instalacje, koszty transportu i strategię recyklingową."},
  {name:"PreZero / Remondis / inni",type:"MAPA RYNKU",text:"Aktualna lista złożonych ofert w postępowaniu Z154/68879 nie jest jeszcze publicznym wynikiem — nie należy przedstawiać potencjalnych wykonawców jako faktycznych oferentów.",source:"Stan na etap przed terminem składania ofert",implication:"Model konkurencji ma działać scenariuszowo, bez udawania znajomości ofert konkurentów."}
];

export const tenderNoticeSections = [
  {title:"Identyfikacja",items:["Postępowanie Z154/68879","Znak sprawy BZP.271.60.2026.MK","Miasto Zabrze – Prezydent Miasta","Przetarg nieograniczony","Zamówienie na usługi","Progi unijne"]},
  {title:"Przedmiot",items:["Odbiór i zagospodarowanie odpadów komunalnych od właścicieli nieruchomości położonych na terenie Zabrza","Szczegółowy opis przedmiotu znajduje się w Części III SWZ"]},
  {title:"Terminy",items:["Składanie ofert: 12.10.2026, 09:00","Otwarcie: 12.10.2026, 09:30","Termin związania ofertą: 08.02.2027, 23:59","Planowany okres: 36 miesięcy od faktycznego rozpoczęcia lub do wyczerpania środków"]},
  {title:"Ekonomia",items:["Wadium: 4 000 000 PLN","Cena: 70%","Poziom recyklingu: 30%","W ogłoszeniu wskazano poziomy 33%, 40%, 45%, 50% oraz poziom wymagany prawem"]},
  {title:"Opcje",items:["Odpady budowlane i rozbiórkowe z gospodarstw domowych","Odkup pojemników","Możliwość zwiększenia zakresu do 20% wartości zamówienia podstawowego"]},
  {title:"Dokumentacja",items:["JEDZ.xml","Ogłoszenie o zamówieniu.pdf","Oświadczenie o elektromobilności.docx","SWZ.doc","OPZ.doc","PPU.doc","RODO.doc","Kalkulacja ceny.xls","Załączniki do OPZ.zip"]},
  {title:"Zasada analityczna",items:["Ogłoszenie daje ramy postępowania.","Pełna kalkulacja wymaga OPZ + PPU + XLS + ZIP + JEDZ.","Brak odczytanego dokumentu nie może być przedstawiany jako potwierdzony fakt."]}
];
