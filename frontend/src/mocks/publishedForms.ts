import type { PublishedForm } from "../types";

/**
 * MOCK: formularze już opublikowane – lista usług po stronie obywatela.
 * Po kliknięciu „Zatwierdź i opublikuj” w edytorze dochodzi tu kolejny formularz.
 *
 * Podstawa prawna tego formularza jest fikcyjna (lokalny regulamin – przykład).
 * Docelowo: GET /forms
 */
const LOCAL_ACT = "Regulamin utrzymania czystości i porządku w gminie (przykład)";

export const publishedForms: PublishedForm[] = [
  {
    id: "form-odpady-gabaryty",
    draftId: "draft-odpady-gabaryty",
    version: 2,
    publishedAt: "2026-11-10T09:00:00+01:00",
    publishedBy: "Anna Nowak",
    summary: "Zamów bezpłatny odbiór mebli i dużych sprzętów spod domu.",
    estimatedMinutes: 3,
    schema: {
      id: "odpady-gabaryty",
      version: 2,
      title: "Zgłoszenie odbioru odpadów wielkogabarytowych",
      issuer: "Urząd Miasta (przykład)",
      sourceFile: "zgloszenie_gabaryty.pdf",
      pages: [
        {
          id: "p-dane",
          title: "Twoje dane",
          fields: [
            {
              id: "imie_nazwisko",
              label: "Imię i nazwisko",
              type: "text",
              required: true,
              prefill: { source: "mObywatel", key: "person.fullName" },
              legalBasis: { act: LOCAL_ACT, unit: "§ 4 ust. 1", quote: "zgłoszenie zawiera imię i nazwisko" },
            },
            {
              id: "adres",
              label: "Adres odbioru",
              type: "text",
              required: true,
              prefill: { source: "mObywatel", key: "address.street" },
              legalBasis: { act: LOCAL_ACT, unit: "§ 4 ust. 1", quote: "adres nieruchomości" },
            },
            {
              id: "telefon",
              label: "Telefon do kierowcy (opcjonalnie)",
              type: "phone",
              required: false,
              helpText: "Kierowca zadzwoni, jeśli nie znajdzie odpadów.",
            },
          ],
        },
        {
          id: "p-odpady",
          title: "Co mamy odebrać?",
          fields: [
            {
              id: "rodzaj",
              label: "Rodzaj odpadów",
              type: "select",
              required: true,
              options: [
                { value: "meble", label: "Meble" },
                { value: "agd", label: "Duży sprzęt AGD" },
                { value: "inne", label: "Inne" },
              ],
              legalBasis: { act: LOCAL_ACT, unit: "§ 4 ust. 2", quote: "rodzaj odpadów" },
            },
            {
              id: "rodzaj_inne",
              label: "Opisz, co to jest",
              type: "textarea",
              required: true,
              visibleIf: { fieldId: "rodzaj", equals: "inne" },
              validation: { maxLength: 300 },
            },
            {
              id: "data",
              label: "Preferowana data odbioru",
              type: "date",
              required: true,
            },
          ],
        },
      ],
    },
  },
];
