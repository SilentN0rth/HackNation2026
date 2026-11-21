import type { PrefillData } from "../types";

/**
 * MOCK: dane „z rejestrów” (mObywatel / CEIDG) – wyłącznie fikcyjne.
 * Klucze odpowiadają Field.prefill.key.
 * PESEL 44051401359 to powszechnie używany przykładowy numer z poprawną sumą kontrolną.
 *
 * Docelowo: GET /prefill?formId=… (po zgodzie obywatela)
 */
export const prefillData: PrefillData = {
  "person.firstName": "Jan",
  "person.lastName": "Kowalski",
  "person.fullName": "Jan Kowalski",
  "person.pesel": "44051401359",
  "address.street": "ul. Przykładowa 12/4",
  "address.postalCode": "85-001",
  "address.city": "Bydgoszcz",
};
