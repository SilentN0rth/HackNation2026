import type { Application } from "../types";

/** MOCK: wnioski obywatela („Twoje sprawy”). Docelowo: GET /applications?mine=true */
export const applications: Application[] = [
  {
    id: "app-001",
    formId: "form-odpady-gabaryty",
    formTitle: "Zgłoszenie odbioru odpadów wielkogabarytowych",
    status: "accepted",
    updatedAt: "2026-11-12T18:30:00+01:00",
    values: { imie_nazwisko: "Jan Kowalski", adres: "ul. Przykładowa 12/4", rodzaj: "meble", data: "2026-11-20" },
    confirmationNo: "UPO/2026/11/000123",
  },
  {
    id: "app-002",
    formId: "form-odpady-gabaryty",
    formTitle: "Zgłoszenie odbioru odpadów wielkogabarytowych",
    status: "draft",
    updatedAt: "2026-11-21T10:15:00+01:00",
    values: { imie_nazwisko: "Jan Kowalski", rodzaj: "agd" },
  },
];
