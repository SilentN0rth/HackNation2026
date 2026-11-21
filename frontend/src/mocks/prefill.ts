import type { PrefillData } from "../types";

/**
 * MOCK: dane inicjalne „z rejestrów” (MLPZ / PESEL – nazwy źródeł jak w COI) – wyłącznie fikcyjne.
 * Klucze odpowiadają Field.prefill.key (= defaultValue w JSON COI, np. „MLPZ.street”).
 * PESEL 44051401359 to powszechnie używany przykładowy numer z poprawną sumą kontrolną.
 *
 * Docelowo: GET /prefill?formId=… (po zgodzie obywatela)
 */
export const prefillData: PrefillData = {
  "PESEL.name": "Jan",
  "PESEL.surname": "Kowalski",
  "PESEL.fullName": "Jan Kowalski",
  "PESEL.pesel": "44051401359",
  "MLPZ.street": "ul. Przykładowa 12/4",
  "MLPZ.postCode": "85-001",
  "MLPZ.city": "Bydgoszcz",
};
