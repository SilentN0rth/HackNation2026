import type { FormSchema } from "../types";

/**
 * Mapowanie naszego modelu ↔ format JSON wymagany przez COI.
 *
 * TODO (gdy zobaczycie przykładowe JSON-y COI z Discorda):
 *  1. Wklejcie jeden przykładowy plik do src/api/__fixtures__/coi-example.json
 *  2. Opiszcie go schematem Zod (CoiFormJsonSchema) i uzupełnijcie dwie funkcje poniżej.
 *  3. Backend może zwracać od razu format COI – fromCoiJson jest już wołane w httpApi.ts,
 *     a wynik i tak przechodzi przez FormSchemaSchema.
 *
 * Do czasu uzupełnienia obie funkcje są „przezroczyste”.
 */

export type CoiFormJson = unknown;

export function toCoiJson(schema: FormSchema): CoiFormJson {
  return schema;
}

export function fromCoiJson(json: CoiFormJson): FormSchema {
  return json as FormSchema;
}
