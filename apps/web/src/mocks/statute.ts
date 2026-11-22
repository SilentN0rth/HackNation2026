import type { StatuteChunk } from "../types";

export const MOCK_ACT = "Ustawa z dnia 21 czerwca 2001 r. o dodatkach mieszkaniowych";

export const statuteChunks: StatuteChunk[] = [
  {
    id: "dm-art2-ust1",
    act: MOCK_ACT,
    unit: "art. 2 ust. 1",
    text:
      "Dodatek mieszkaniowy przysługuje najemcom oraz podnajemcom lokali mieszkalnych, " +
      "właścicielom lokali mieszkalnych oraz innym osobom posiadającym tytuł prawny do zajmowanego lokalu mieszkalnego.",
  },
  {
    id: "dm-art3-ust1",
    act: MOCK_ACT,
    unit: "art. 3 ust. 1",
    text:
      "Dodatek mieszkaniowy przysługuje osobom, których średni miesięczny dochód na jednego członka " +
      "gospodarstwa domowego w okresie 3 miesięcy poprzedzających datę złożenia wniosku nie przekracza progu określonego w ustawie.",
  },
  {
    id: "dm-art5-ust1",
    act: MOCK_ACT,
    unit: "art. 5 ust. 1",
    text: "Normatywna powierzchnia użytkowa lokalu mieszkalnego zależy od liczby osób w gospodarstwie domowym.",
  },
  {
    id: "dm-art6-ust1",
    act: MOCK_ACT,
    unit: "art. 6 ust. 1",
    text:
      "Wydatki przypadające na normatywną powierzchnię użytkową lokalu obejmują czynsz, " +
      "opłaty za energię cieplną, wodę oraz odbiór nieczystości.",
  },
  {
    id: "dm-art7-ust1",
    act: MOCK_ACT,
    unit: "art. 7 ust. 1",
    text:
      "Dodatek mieszkaniowy przyznaje wójt, burmistrz albo prezydent miasta na wniosek osoby uprawnionej. " +
      "Do wniosku dołącza się deklarację o dochodach gospodarstwa domowego.",
  },
  {
    id: "dm-art7-ust2",
    act: MOCK_ACT,
    unit: "art. 7 ust. 2",
    text:
      "Wniosek zawiera imię i nazwisko wnioskodawcy, numer PESEL, adres zamieszkania, tytuł prawny do lokalu, " +
      "powierzchnię użytkową lokalu, liczbę osób w gospodarstwie domowym oraz informację o wyposażeniu lokalu " +
      "w instalację centralnego ogrzewania i centralnej ciepłej wody.",
  },
];
