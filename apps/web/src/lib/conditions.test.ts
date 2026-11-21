import { describe, expect, it } from "vitest";
import type { Field, FormSchema } from "@/types";
import { visiblePages } from "./conditions";

const field = (id: string, visibleIf?: Field["visibleIf"]): Field => ({ id, label: id, type: "text", required: false, visibleIf });

const schema: FormSchema = {
  id: "s",
  version: 1,
  title: "Test",
  issuer: "Urząd",
  sourceFile: "test.pdf",
  pages: [
    {
      id: "p1",
      title: "Dane",
      fields: [
        field("ma_dzieci"),
        field("liczba_dzieci", { fieldId: "ma_dzieci", equals: true }),
        field("powod_braku", { fieldId: "ma_dzieci", equals: true, negate: true }),
      ],
    },
    { id: "p2", title: "Dzieci", visibleIf: { fieldId: "ma_dzieci", equals: true }, fields: [field("imie_dziecka")] },
    { id: "p3", title: "Wybór", visibleIf: { fieldId: "tryb", equals: "pelny" }, fields: [field("x")] },
  ],
};

const ids = (values: Record<string, string | boolean>) =>
  visiblePages(schema, values).map((p) => `${p.id}:${p.fields.map((f) => f.id).join(",")}`);

describe("visiblePages", () => {
  it("bez wartości pokazuje tylko pola bez warunku i z warunkiem zanegowanym", () => {
    expect(ids({})).toEqual(["p1:ma_dzieci,powod_braku"]);
  });
  it("spełniony warunek pokazuje pole i stronę, ukrywa zanegowane", () => {
    expect(ids({ ma_dzieci: true })).toEqual(["p1:ma_dzieci,liczba_dzieci", "p2:imie_dziecka"]);
  });
  it("porównuje ściśle (string ≠ boolean)", () => {
    expect(ids({ ma_dzieci: "true" })).toEqual(["p1:ma_dzieci,powod_braku"]);
    expect(ids({ tryb: "pelny" })).toContain("p3:x");
  });
  it("nie mutuje schematu", () => {
    visiblePages(schema, {});
    expect(schema.pages[0].fields).toHaveLength(3);
  });
});
