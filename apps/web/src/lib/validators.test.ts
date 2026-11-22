import { describe, expect, it } from "vitest";
import type { Field } from "@/types";
import { citizenFileHint, justificationSchema, validateCitizenFile, validateField, validateUploadFile } from "./validators";

const field = (over: Partial<Field> = {}): Field => ({ id: "f", label: "Pole", type: "text", required: false, ...over });

describe("validateField – wymagalność", () => {
  it("puste pole wymagane daje komunikat", () => {
    for (const v of [undefined, "", false]) expect(validateField(field({ required: true }), v)).toBe("To pole jest wymagane.");
  });
  it("puste pole nieobowiązkowe jest poprawne", () => {
    expect(validateField(field({ type: "pesel" }), "")).toBeNull();
    expect(validateField(field(), undefined)).toBeNull();
  });
  it("zaznaczony checkbox spełnia wymaganie", () => {
    expect(validateField(field({ type: "checkbox", required: true }), true)).toBeNull();
  });
});

describe("validateField – PESEL", () => {
  const pesel = field({ type: "pesel" });
  it("akceptuje PESEL z poprawną cyfrą kontrolną", () => {
    expect(validateField(pesel, "44051401359")).toBeNull();
  });
  it("odrzuca złą cyfrę kontrolną, długość i litery", () => {
    for (const v of ["44051401358", "4405140135", "440514013591", "4405140135a"])
      expect(validateField(pesel, v)).toMatch(/PESEL/);
  });
});

describe("validateField – formaty", () => {
  it("kod pocztowy 00-000", () => {
    const f = field({ type: "postalCode" });
    expect(validateField(f, "00-950")).toBeNull();
    expect(validateField(f, "00950")).toBe("Wpisz kod w formacie 00-000.");
  });
  it("telefon z opcjonalnym +48 i spacjami", () => {
    const f = field({ type: "phone" });
    expect(validateField(f, "+48 600 700 800")).toBeNull();
    expect(validateField(f, "600700800")).toBeNull();
    expect(validateField(f, "60070080")).toBe("Wpisz 9 cyfr numeru telefonu.");
  });
  it("e-mail", () => {
    const f = field({ type: "email" });
    expect(validateField(f, "jan@example.pl")).toBeNull();
    expect(validateField(f, "jan@")).toBe("Wpisz poprawny adres e-mail.");
  });
  it("długość i własny wzorzec", () => {
    const f = field({ validation: { minLength: 3, maxLength: 5, pattern: "^[a-z]+$", patternMessage: "Tylko małe litery." } });
    expect(validateField(f, "abc")).toBeNull();
    expect(validateField(f, "ab")).toBe("Wpisz co najmniej 3 znaków.");
    expect(validateField(f, "abcdef")).toBe("Możesz wpisać najwyżej 5 znaków.");
    expect(validateField(f, "ABC")).toBe("Tylko małe litery.");
  });
});

describe("validateField – liczby", () => {
  const f = field({ type: "number", validation: { min: 1, max: 10 } });
  it("akceptuje liczbę w zakresie, także z przecinkiem", () => {
    expect(validateField(f, "5")).toBeNull();
    expect(validateField(f, "2,5")).toBeNull();
  });
  it("odrzuca nie-liczbę i wartości spoza zakresu", () => {
    expect(validateField(f, "abc")).toBe("Wpisz liczbę.");
    expect(validateField(f, "0")).toBe("Wartość nie może być mniejsza niż 1.");
    expect(validateField(f, "11")).toBe("Wartość nie może być większa niż 10.");
  });
});

describe("validateUploadFile", () => {
  const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);
  it("akceptuje dozwolony format", () => {
    expect(validateUploadFile(file("wniosek.PDF"))).toBeNull();
  });
  it("odrzuca nieobsługiwane rozszerzenie", () => {
    expect(validateUploadFile(file("wniosek.exe"))).toMatch(/Nieobsługiwany format/);
  });
  it("odrzuca niedozwolone znaki w nazwie", () => {
    expect(validateUploadFile(file("wnio;sek.pdf"))).toMatch(/niedozwolone znaki/);
  });
  it("odrzuca zbyt długą nazwę", () => {
    expect(validateUploadFile(file(`${"a".repeat(250)}.pdf`))).toMatch(/250 znaków/);
  });
});

describe("justificationSchema", () => {
  it("wymaga 10–500 znaków po przycięciu", () => {
    expect(justificationSchema.safeParse("   uzasadnienie ").success).toBe(true);
    expect(justificationSchema.safeParse("  krótko  ").success).toBe(false);
    expect(justificationSchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("validateField – dane podmiotu (NIP, REGON, KRS)", () => {
  it("NIP: suma kontrolna i 10 cyfr", () => {
    const f = field({ label: "NIP" });
    expect(validateField(f, "5260001246")).toBeNull();
    for (const v of ["5260001247", "526000124", "52600012461"]) expect(validateField(f, v)).toMatch(/NIP/);
  });
  it("REGON: 9 lub 14 cyfr z sumą kontrolną", () => {
    const f = field({ label: "REGON" });
    expect(validateField(f, "123456785")).toBeNull();
    expect(validateField(f, "12345678512347")).toBeNull();
    for (const v of ["123456784", "12345678", "12345678512340"]) expect(validateField(f, v)).toMatch(/REGON/);
  });
  it("KRS jest nieobowiązkowy, ale gdy podany, ma 10 cyfr", () => {
    const f = field({ label: "Numer KRS" });
    expect(validateField(f, "")).toBeNull();
    expect(validateField(f, "0000123456")).toBeNull();
    expect(validateField(f, "12345")).toBe("Wpisz 10 cyfr.");
  });
  it("etykieta nie zmienia walidacji pól innych typów", () => {
    expect(validateField(field({ label: "NIP", type: "textarea" }), "abc")).toBeNull();
  });
});

describe("pliki obywatela", () => {
  const upload = field({ label: "Plik dokumentu z pełnomocnictwem", type: "file" });
  const transfer = field({ label: "Plik z potwierdzeniem przelewu", type: "file" });
  it("podpowiedź zawiera formaty i limit", () => {
    expect(citizenFileHint(upload)).toBe("Dozwolone formaty: PDF, JPG, JPEG, PNG, XML. Maksymalny rozmiar: 10 MB.");
    expect(citizenFileHint(transfer)).toBe("Dozwolone formaty: PDF. Maksymalny rozmiar: 10 MB.");
  });
  it("odrzuca zły format i za duży plik", () => {
    expect(validateCitizenFile(upload, { name: "a.pdf", size: 1000 })).toBeNull();
    expect(validateCitizenFile(upload, { name: "a.exe", size: 1000 })).toMatch(/format/);
    expect(validateCitizenFile(transfer, { name: "a.png", size: 1000 })).toMatch(/PDF/);
    expect(validateCitizenFile(upload, { name: "a.pdf", size: 10 * 1024 * 1024 + 1 })).toBe("Plik może mieć najwyżej 10 MB.");
  });
});
