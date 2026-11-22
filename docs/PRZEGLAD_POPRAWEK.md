# Przegląd projektu: poprawki i profilaktyka

Data przeglądu: 2026-11-22.

Przegląd porównuje nasz wynik (`outputs/*.json`, generator w `apps/api`) z materiałami organizatora:
reguły techniczne, standardy projektowania formularzy, opis importowanego JSON, słowniki, dane inicjalne
oraz wzorce dla formularzy 1 i 5 (`data-pdf/`).

## 1. Zakres i ograniczenia

**Sprawdzone:**
- wszystkie 9 plików `outputs/0*.json` skryptem walidującym reguły techniczne,
- porównanie plików 05 i 01 z wzorcami organizatora,
- `apps/api/app/coi/builder.py` i szablon `apps/api/app/coi/templates/standard.json`,
- testy: pytest (127 przeszło, 3 pominięte), vitest (28 z 28), ruff (czysto).

**Niesprawdzone:**
- typecheck (`tsc`) i ESLint dla `apps/web`. Wynik nie dotarł do przeglądu, więc nic o nich nie wiadomo.
- Testy e2e (Playwright).
- Działanie aplikacji w przeglądarce, w tym panel urzędnika, e-usługa obywatela i PWA.
- Walidacja pełnym JSON Schema z `importowanyPlikJsonSchemat.json`.
- Zgodność z treścią zadania i kryteriami punktacji. W repozytorium nie ma opisu zadania, tylko materiały.

**Założenie:** ocena zgodności opiera się na regułach technicznych i standardach, bo te dokumenty są „twarde”.
Wzorce organizatora (formularze 1 i 5) traktuję jako ilustrację, a nie wyrocznię, bo same mają puste walidacje.

## 2. Podsumowanie

| # | Problem | Waga | Źródło | Dotyczy |
|---|---|---|---|---|
| P1 | Formularze 8 i 9 mają śmieciową ekstrakcję | Krytyczna | heurystyki, `understand/` | 08, 09 |
| P2 | Puste walidacje na stronie „Dane” | Wysoka | szablon `standard.json` | wszystkie |
| P3 | Brak pól REGON, KRS, PESEL (inna osoba), checkboxów w adresie | Wysoka | szablon `standard.json` | wszystkie |
| P4 | Pola `EXTERNAL_SYSTEM` bez `readOnly` | Średnia (wymaga decyzji) | szablon `standard.json` | wszystkie |
| P5 | `TEXT_BLOCK` na stronie `FINISH` | Średnia (wymaga decyzji) | szablon `standard.json` | wszystkie |
| P6 | Zgoda skopiowana ze wzorca, link nie działa | Średnia | szablon `standard.json` | wszystkie |
| P7 | Tytuły i nazwy organu | Średnia | normalizacja tytułów, `builder.py` | 01, 04–09 |
| P8 | Drobne błędy w pliku 05 | Niska | ekstrakcja | 05 |
| P9 | Raport pokazuje „bledyCOI: 0” mimo złej jakości | Średnia | `batch_convert.py`, `coi/validator.py` | wszystkie |

Większość problemów (P2–P6) ma jedną przyczynę: `build()` kopiuje szablon `standard.json` bez zmian,
a ten szablon jest wycięty z wzorca organizatora. Dlatego jedna poprawka szablonu naprawia wszystkie 9 plików naraz.

## 3. Szczegółowe poprawki

### P1. Formularze 8 i 9: ekstrakcja pól daje śmieci

**Objawy (z plików wynikowych):**
- Nr 9 (stypendium, 3 wnioski w 1): zdanie „Załącznik Nr 3 do zarządzenia Nr 245/IX/2024…” i nagłówek „Rodzaje wniosków”
  stały się polami `TEXT_FIELD` na stronie „Szczegóły wniosku”.
- Nr 9: strony „Zgoda w imieniu kandydata nieletniego do stypendium” mają 36 i 49 pól tekstowych. To akapity papierowej zgody,
  a nie pola do wypełnienia.
- Nr 9: pytanie „Imię i nazwisko kandydata” ma typ `RADIO`, a jego opcjami są długie zdania zgód.
- Nr 9: brak pola wyboru rodzaju wniosku (stypendium, nagroda, wyróżnienie) i brak stanów przełączających strony.
  Przepływ `flow` to liniowy łańcuch, więc wypełniający musi przejść wszystkie 9 stron, także te nieistotne dla jego wyboru.
- Nr 8 (opłata za odpady): strony nazywają się „Pesel” (26 pól), „Tak nie”, „Gdynia” (sekcja z 8 polami), „Nip/regon” (18 pól).
  To fragmenty papierowego układu, a nie tematy dla obywatela.
- W `outputs/raport.json` formularz 8 ma 13 uwag (`uwagi`), a mimo to wynik uznano za zakończony.

**Przyczyna:** heurystyki traktują każdy wiersz z kropkami lub pogrubieniem jako pole, a nagłówek tabeli lub pogrubiony
napis jako tytuł strony. Dla długich, wielotabelowych formularzy nie ma kroku, który odróżnia treść (akapit, pouczenie)
od pola.

**Poprawka (kolejność):**
1. Dodać klasyfikację wiersza przed zamianą na pole: `pole` / `akapit` / `nagłówek` / `pouczenie` / `opcja`.
   Akapit dłuższy niż ok. 120 znaków bez znaku wypełnienia (`....`, `…`, pole tabeli) nie powinien stawać się polem.
   Powinien trafić do `TEXT_BLOCK` (albo do opisu sekcji).
2. Zgody i oświadczenia z papieru zamieniać na `CONSENT_SECTION` z `consentSectionConfig.consents[]`. Nie generować dla nich `RADIO`
   ani pól tekstowych. Standardy wprost zabraniają zgód w polach wyboru.
3. Formularz łączący kilka wniosków wykrywać po powtarzających się tytułach „Wniosek o przyznanie X”. Dla takiego formularza:
   - dodać na stronie przedmiotu wniosku pole `RADIO` „Wybierz rodzaj wniosku”,
   - każdy wariant zamknąć w osobnej stronie lub grupie stron i objąć stanem `SHOW`,
   - dodać `flow.links` prowadzące do właściwej strony.
   Standardy każą stosować strony alternatywne, gdy od odpowiedzi zależy cały etap formularza.
4. Tytuły stron nadawać z nagłówków merytorycznych (np. „Dane sportowca”, „Osiągnięcia sportowe”). Nie brać fragmentów papierowych
   („Tak nie”, „Pesel”, „Gdynia”).
5. Pola z jednym znacznikiem wypełnienia, ale bez etykiety, odrzucać z flagą „wymaga przeglądu” zamiast tworzyć pusty `TEXT_FIELD`.

**Weryfikacja:** po zmianie ponownie wygenerować 08 i 09 i ręcznie przejrzeć listę stron i pól. Zaimplementować test, że
żadne pole nie ma tytułu dłuższego niż np. 120 znaków (patrz sekcja 4).

### P2. Puste walidacje na stronie „Dane”

**Objaw:** około 40 pól w każdym pliku ma `"validation": []`. Dotyczy to m.in. radia „Wybierz, w czyim imieniu wnioskujesz”,
adresów i uploadów.

**Wymaganie:** standardy wymagają `REQUIRED` m.in. na polach: Imię, Nazwisko, Numer PESEL, Podmiot wniosku, Kraj, Kod pocztowy, Numer budynku,
Plik z pełnomocnictwem, Plik z potwierdzeniem przelewu. Reguły techniczne mówią, że każde pole musi mieć określoną obligatoryjność.

**Poprawka w `apps/api/app/coi/templates/standard.json`:**
- `REQUIRED` na wszystkich polach obowiązkowych wymienionych w standardach.
- `PESEL` na `numer_pesel` (Twoje dane i Dane innej osoby).
- `NIP`, `REGON` na polach podmiotu.
- `ZIP_CODE` na polskim kodzie pocztowym (w adresach zagranicznych kod pocztowy bez walidacji kształtu, tylko `REQUIRED`).
- `EMAIL` na adresie e-mail na stronie kontaktu.
- Dla pól opcjonalnych (telefon, e-mail) zostawić walidacje bez `REQUIRED`, ale z walidatorem kształtu.

**Uwaga o stanach:** pole ukryte przez `SHOW` z `REQUIRED` musi być wymagane tylko wtedy, gdy jest widoczne. Sprawdzić, jak silnik
po stronie `apps/web` i `apps/api/app/mapping/frontend.py` traktuje ukryte pola wymagane. Inaczej obywatel nie wyśle wniosku,
bo nie może wypełnić pola, którego nie widzi.

### P3. Brakujące pola w sekcjach standardowych

Zgodnie ze standardami brakuje:
- **Dane podmiotu:** REGON (`REGON`) i Numer KRS (opcjonalny, wzorzec `^\d{10}$`, komunikat „Wpisz 10 cyfr.”).
  Obecnie są tylko Nazwa i NIP.
- **Dane innej osoby:** Numer PESEL (wymagany, `PESEL`). Obecnie są tylko Imię i Nazwisko.
- **Adres:** checkboxy „Brak nazwy ulicy” i „Brak numeru lokalu” przy ulicy i numerze lokalu oraz placeholdery
  (`__-___` dla kodu, przykłady ulic). Dla adresów zagranicznych „Brak kodu pocztowego”.
- **Adres:** pole wyboru powiatu, gminy i miejscowości. Obecnie jest jedno pole `TERYT_4G_DOWODOWY` (zgodne z wzorcem organizatora).
  Standard opisuje cztery zależne od siebie listy (województwo, powiat, gmina, miejscowość). Sprawdzić, czy jedno pole słownikowe
  z `multiLevelTree` (jak we wzorcu) wystarcza, czy trzeba rozbić na cztery, bo słownik `Powiat`, `Gmina`, `Miejscowość`
  jest w materiałach wymieniony osobno.

Ograniczenie: schemat JSON nie ma dedykowanych pól na „checkbox wyłączający pole” ani placeholder. Opcje: osobny `CHECKBOX` z stanem `READ_ONLY`
na polu docelowym (jsonata) albo użycie `tooltipMessage`/`description`. Wybrać jedno podejście i zastosować je spójnie.

### P4. Pola `EXTERNAL_SYSTEM` bez `readOnly` (wymaga decyzji)

**Objaw:** w każdym pliku 4 pola (`kod_pocztowy`, `ulica`, `numer_budynku`, `numer_lokalu` z `MLPZ.*`) mają `readOnly: false`.

**Konflikt w materiałach:**
- PDF „Dane inicjalne”: pole zasilane z rejestru musi być `readOnly`, a gdy rejestr nie ma danych, użytkownik nie może ich wpisać.
- Standardy (Adres, Dane do kontaktu): obywatel „może zmienić lub usunąć” dane do kontaktu. Dla adresu użytkownik też zmienia dane.

**Rekomendacja:** sekcja „Twoje dane” (Imię, Nazwisko, PESEL) jest już `readOnly`. Telefon i e-mail zostawić edytowalne, bo tak mówi standard
kontaktu. Adres zamieszkania zostawić edytowalny (standard każe poprawiać dane), ale to jest decyzja zespołu, bo PDF mówi inaczej.
Zapisać decyzję w `docs/ARCHITEKTURA.md`, żeby sędzia widział, że jest świadoma.

### P5. `TEXT_BLOCK` na stronie `FINISH` (wymaga decyzji)

Reguły techniczne: na stronie końcowej może być wyłącznie `INFO_SECTION`. Standardy i wzorzec: `TEXT_BLOCK`.

**Rekomendacja:** zmienić na `INFO_SECTION` (pole `description` obowiązkowe, `techName` obowiązkowy). Reguły techniczne mówią o tym, co
walidator importu przyjmie, a standardy opisują wygląd. Ryzyko jest asymetryczne: błędny typ na końcu może odrzucić import,
a `INFO_SECTION` nie narusza standardów, bo też jest komponentem informacyjnym.

Po zmianie dopilnować, że frontend (`apps/web`) renderuje `INFO_SECTION` tak samo jak `TEXT_BLOCK` (HTML w `description`).

### P6. Sekcja zgód skopiowana ze wzorca

- Wszystkie formularze mają tę samą zgodę, z HTML-em wklejonym z edytora (style inline).
- Odnośnik ma `href="klauzulą informacyjną"`. To nie jest adres URL, więc link nie działa.
- Standardy: nie umieszczać pełnej klauzuli na formularzu, tylko odsyłacz do strony urzędu (BIP). Link ma mieć opis i ikonę zewnętrznego linku, bez kropki na końcu.

**Poprawka:**
1. Zastąpić `href` rzeczywistym adresem (konfigurowalnym per urząd, w `config.py`) lub oznaczyć jako placeholder i dodać flagę „uzupełnij adres klauzuli”.
2. Usunąć style inline z HTML. Zostawić prosty `<p>` i `<a>`.
3. Dostosować treść do sprawy (nazwa urzędu, cel przetwarzania). Preferować czas teraźniejszy i formy neutralne płciowo
   („Zapoznaję się z…”, a nie „Zapoznałem się”).
4. `files` w `consentSectionConfig` wypełniać, gdy papier ma załącznik klauzuli.

### P7. Tytuły i nazwa organu

- **Wielkie litery:** pliki 04, 05, 06 mają tytuły zaczynające się od „WNIOSEK”. Wzorzec ma „Wniosek o…”. Dodać normalizację
  (zamiana CAPS na zwykły zapis zdania), bo to zwykle nagłówek z papieru.
- **Skróty:** nr 8 „Deklaracja o wysokości miesięcznej opłaty” bez „za gospodarowanie odpadami komunalnymi”, a nr 9 bez „nagrody lub wyróżnienia sportowego”.
  Tytuł powinien jasno wskazywać cel, więc nie obcinać w środku nazwy usługi. Limit to 255 znaków, a standard mówi „jak najkrótszy”,
  czyli skracać wyłącznie przez usunięcie numerów przepisów.
- **Organ czy urząd:** gdy papier jest adresowany do Wójta lub Prezydenta (01, 04, 08, 09), etykieta to „Nazwa organu”,
  a sekcja „Organ, do którego jest składany wniosek”. Obecnie wszędzie „Urząd…” (technicznie `ISSUER_FIELDS` ma `nazwa_organu`,
  ale szablon go nie używa). Dodać wybór wariantu w `build()` na podstawie `form.issuer`.
- **Niepełna nazwa:** 06 ma „Urząd Miasta i Gminy” bez miejscowości. Ekstrakcja powinna zgłaszać flagę, gdy nazwa organu nie zawiera nazwy własnej.
- **Znaki:** tytuł 04 ma ukośnik („wynajęcie/użyczenie”). Sprawdzić, czy zgadza się z tytułem usługi, który ma być widoczny dla obywatela.

### P8. Drobne błędy w pliku 05

- Etykieta „Wybierz, co mamy zrobić z nadpłatą” zaczyna się znakiem nowej linii (`\n`). Dodać `strip()` na każdym `title`, `description` i `options[].name`.
- Opcja „Zwrócić przelewem na wskazany rachunek” zgodna z papierem, ale wzorzec organizatora ma „…na rachunek bankowy”. Do decyzji, czy trzymać się papieru.
- Strona 2 to jedna sekcja „Szczegóły wniosku”, a standard każe grupować pola w tematyczne sekcje. Wzorzec ma trzy: Informacje o nadpłacie,
  Rozliczenie nadpłaty, Korekta deklaracji. Dodać podział sekcji po zmianie tematu (nagłówek, pytanie typu radio zaczyna nową sekcję).
- „Rodzaj podatku” zamiast „Podatek, którego dotyczy nadpłata”. Etykiety powinny wynikać z papieru, ale ujednolicić, jeśli standardy
  podają wzór.
- W stanach `SHOW` jsonata dla `nazwa_podatku` i `numer_rachunku` odwołuje się do `tabs['Szczegóły wniosku' in title]`. Przy zmianie
  nazwy strony zapytania przestają działać. Patrz sekcja 4 (stabilność jsonaty).

### P9. Raport mówi „bledyCOI: 0” przy złej jakości

`outputs/raport.json` liczy tylko błędy formalne COI, więc 08 i 09 (z krytycznymi problemami jakości) wyglądają na poprawne.
Dodać do raportu wskaźniki jakości (patrz sekcja 4) i traktować przekroczenie progu jako błąd, nie tylko „uwagę”.

## 4. Jak uniknąć kolejnych problemów (profilaktyka)

### 4.1. Walidator jakości (nie tylko formalności)

Rozszerzyć `apps/api/app/coi/validator.py` (lub dodać linter w `app/lint/`) o reguły, które wykryłyby wszystkie problemy z tego przeglądu:

**Reguły z dokumentu „Reguły techniczne” (twarde, błąd):**
- tytuł formularza ≤ 255 znaków,
- ≥ 2 strony, dokładnie jedna `FINISH` i to ostatnia,
- każda strona ma ≥ 1 pole, każde pole leży w sekcji, brak sekcji w sekcji,
- na `FINISH` wyłącznie `INFO_SECTION`,
- każde pole wejściowe ma jawną obligatoryjność (`REQUIRED` lub świadomy brak),
- każda strona (poza pierwszą) ma link przychodzący, każda (poza `FINISH`) wychodzący,
- komponent zależny od wyboru użytkownika ma `states` z jsonatą,
- słownik tylko w `SELECT`, `RADIO`, `CHECKBOX`; słowniki adresowe i `Kraje` tylko w `SELECT`.

**Reguły jakości (ostrzeżenie lub błąd w zależności od progu):**
- tytuł pola > 120 znaków,
- tytuł strony lub sekcji, który nie ma sensu (np. samo „Tak nie”, jedno słowo kapitalikami, nazwa miasta),
- strona z > 25 polami lub sekcja z > 15 polami (sygnał złej segmentacji),
- pole bez etykiety (`title` pusty), poza `TEXT_BLOCK`/`INFO_SECTION`/`CONSENT_SECTION`,
- `title`/`description` z białymi znakami na brzegach lub `\n`,
- pole `RADIO`/`SELECT`/`CHECKBOX` z opcją dłuższą niż 120 znaków,
- pole o nazwie PESEL/NIP/REGON/e-mail/kod pocztowy bez odpowiedniego walidatora,
- `defaultValueType: EXTERNAL_SYSTEM` bez `readOnly`, jeśli taka jest decyzja z P4,
- link w `consentSectionConfig` z `href` niebędącym URL-em,
- wszystkie `states.query` kompilowalne i wskazujące istniejące `techName` oraz tytuł strony (patrz 4.3).

**Zasada raportu:** `bledyCOI` jako suma reguł twardych, osobno `ostrzezenia`, osobno `jakosc` (0–100). Formularz „gotowy” tylko przy 0 błędów
i jakości powyżej progu.

### 4.2. Testy regresyjne na formularzach organizatora

- Dla formularzy 1 i 5 mamy wzorce w `data-pdf/`. Dodać test, który porównuje wynik z wzorcem: te same strony, sekcje, typy pól, liczba stanów.
  Różnice dozwolone opisać jawnie (lista wyjątków), reszta ma być identyczna. Test pilnuje, żeby zmiana generatora nie zepsuła tego, co działa.
- Dla pozostałych 7 formularzy zapisać „złoty plik” (snapshot) po ręcznym przeglądzie i porównywać strukturę (bez UUID).
  Zmiana wymaga świadomego zatwierdzenia nowego snapshotu.
- Test jakości: skrypt z sekcji 4.1 uruchamiany na wszystkich `outputs/0*.json` w CI. Niezaliczenie progu zatrzymuje merge.
- Test na dokładnie tych objawach z P1: brak pola, którego tytuł przekracza limit; brak strony nazwanej „Tak nie”.

### 4.3. Stabilność jsonaty

- Zapytania odwołują się do strony po tytule (`tabs['Dane' in title]`) i do sekcji po `techName`. Zmiana tytułu strony po wygenerowaniu psuje stany.
  Zasady: tytuł strony po wygenerowaniu jest stały, a edytor w `apps/web` ostrzega lub przebudowuje zapytania przy zmianie tytułu lub `techName`.
- Przed zapisem kompilować każde zapytanie biblioteką jsonata (po stronie api jest `app/coi/jsonata.py`) i sprawdzać, że wskazuje
  istniejące pole. Wynik zapisywać w raporcie.
- Testować zapytania na przykładowych odpowiedziach: wybór „Innej osoby” ukrywa „Dane podmiotu”, wybór „Tak” w opłacie skarbowej pokazuje plik.
- Rozważyć jeden generator zapytań (`show_query`) używany wszędzie, a nie ręcznie składane napisy.

### 4.4. Jedno źródło prawdy dla szablonu standardowych sekcji

- Rozbić `standard.json` na bloki: Urząd/Organ, Podmiot wniosku, Twoje dane, Adres (PL/zagranica), Dane innej osoby, Dane podmiotu,
  Pełnomocnictwo, Opłata skarbowa v1/v2, Dane do kontaktu, Zgoda, Podsumowanie, Podgląd. Dokładnie jak w rozdziale 2 standardów.
  Każdy blok trzymać w osobnym pliku i składać w `build()` zależnie od tego, kto może złożyć wniosek (tylko osoba fizyczna, tylko podmiot,
  oba). Standardy mówią, że opcje „Podmiot wniosku” zależą od formularza.
- Zamiast kopii, generować bloki z jednej definicji (YAML) i pilnować je testem zgodności z dokumentem standardów.
- Prostą kontrolą jest tabela „sekcja → wymagane pola → walidatory” w kodzie i test, że każdy blok jest z nią zgodny.

### 4.5. Rozpoznawanie, kto może wnioskować

Standard wymaga dopasowania opcji do formularza: tylko osoba fizyczna (dwie opcje), tylko podmiot, albo wszystkie trzy.
Wykrywać na podstawie papieru (czy są pola NIP/REGON, „imię i nazwisko” itd.) i nie dodawać sekcji „Dane podmiotu” oraz „Pełnomocnictwo”,
gdy papier ich nie przewiduje. Nadmiarowe sekcje wydłużają formularz i wprowadzają obywatela w błąd.

### 4.6. Słowniki

- Materiały dopuszczają słowniki: Województwo, Powiat, Gmina, Miejscowość, Kraje, Numery kierunkowe. Zastosować „Numery kierunkowe” przy polach
  telefonu (obecnie telefon jest zwykłym `TEXT_FIELD`).
- Zadanie opcjonalne: zaproponować nowy słownik (nazwa, struktura, zastosowanie). Dobre kandydaty z naszych formularzy:
  dyscypliny sportowe (nr 9), rodzaje podatków (nr 5), rodzaje frakcji odpadów (nr 8), rodzaje robót w pasie drogowym (nr 6),
  rasy psów (nr 7). Spisać propozycję w `docs/ARCHITEKTURA.md`.
- Test zgodności: słownik tylko w dozwolonych typach pól, a nazwa słownika istnieje w `app/dictionaries.py`.

### 4.7. Dane inicjalne

- Trzy źródła: `PESEL`, `PESEL_ADDRESS`, `MLPZ`. Zapisać w kodzie dozwolone atrybuty każdego źródła (z PDF) i walidować `defaultValue` jako `ŹRÓDŁO.atrybut`.
  Obecnie sprawdzić, czy nie ma literówek (np. `MLPZ.apartment` jest w specyfikacji).
- Użyć właściwego źródła. „Twoje dane” według standardu pochodzą z MLPZ (Imię z MLPZ…), a wzorzec organizatora używa `PESEL.name`.
  Oba są dopuszczalne, ale wybrać jedno i opisać.
- Wartość `defaultValue` dla `EXTERNAL_SYSTEM` to napis „ŹRÓDŁO.atrybut”. Pole bez danych w rejestrze zostaje puste i niemożliwe do ręcznego wypełnienia
  (jeśli `readOnly`).

### 4.8. Język i dostępność (standardy)

- Dodać lint językowy (`app/lint/`): imiesłowy na „-ąc”, bezosobowe formy, słowa ze wskazaniem płci („zapoznałem się”), skróty bez wyjaśnienia,
  zdania dłuższe niż ok. 25 słów.
- WCAG 2.1 AA po stronie `apps/web`: kontrast, etykiety, kolejność fokusu, komunikaty błędów dla czytników. `app/lint/wcag.py` istnieje,
  sprawdzić, czy obejmuje wszystkie komponenty i czy jest w CI.
- Układ jednokolumnowy: w pliku `cols: 3`, `x: 0` dla wszystkich komórek. Test, że nie ma dwóch pól w tym samym wierszu.
- Lista rozwijana tylko, gdy opcji > 5. Wyszukiwarka (`searchEnabled`) gdy opcji > 15. Mniej opcji to `RADIO` lub `CHECKBOX`. Dodać do linta.
- Nie używać `CHECKBOX` do zgód (tylko `CONSENT_SECTION`).

### 4.9. Strony i przepływ

- Kolejność stron: Dane (strony stron postępowania) → Przedmiot wniosku → Dane do kontaktu i zgody (przedostatnia) → Strona końcowa.
  Nasze pliki spełniają to dla 1–7. Dodać test, że przedostatnia strona ma kontakt i zgody, a ostatnia ma wyłącznie `INFO_SECTION`.
- Przy stronach alternatywnych: `flow.links` z warunkami. Sprawdzić, czy format importu przewiduje warunek na linku. Schemat ma tylko `id`,
  `source`, `target`. Wtedy alternatywy realizować stanami `SHOW` na sekcjach, a nie stronami. Zapisać wniosek w dokumentacji.
- Podsumowanie i Podgląd na stronie końcowej: dodać bloki z tytułem „Podsumowanie” i „Podgląd” oraz tekstem ze standardów
  („Zanim przejdziesz do wyboru sposobu podpisu, sprawdź dane na podglądzie…”).

### 4.10. Proces

- **Przegląd ręczny przed oddaniem:** dla każdego formularza otworzyć wynik w aplikacji i przejść ścieżki: „Swoim”, „Innej osoby”,
  „Osoby prawnej” (Pełnomocnik, Reprezentant). Zrobić to jako e2e (Playwright) na formularzach 1 i 5 i dla jednej ścieżki każdego z pozostałych.
- **Jeden skrypt „sprawdź wszystko”** (`npm run check:outputs`), który: waliduje JSON-y schematem z materiałów, uruchamia linta jakości,
  porównuje z wzorcami i wypisuje raport. Uruchamiany w CI.
- **Zamrażanie wersji:** po zatwierdzeniu `outputs/` oznaczyć commit tagiem, żeby wynik oddany organizatorom można było odtworzyć.
- **Plik z decyzjami:** spisać decyzje dotyczące konfliktów w materiałach (P4, P5, wybór źródła danych inicjalnych, układ adresu).
  Przy rozbieżnościach w dokumentach organizatorów sędzia ma wtedy dowód, że to świadomy wybór.
- **Brak ręcznej edycji `outputs/`:** poprawki tylko w generatorze i szablonach, a pliki odtwarzać skryptem
  (`apps/api/scripts/batch_convert.py`). Inaczej następne uruchomienie cofnie poprawki.

## 5. Proponowana kolejność prac

1. **Szybko, jeden commit (szablon):** P2, P3, P5, P6 w `standard.json`, plus `strip()` z P8. Naprawia wszystkie 9 plików.
2. **Decyzje zespołu:** P4 i P5. Zapisać w `docs/ARCHITEKTURA.md`.
3. **Normalizacja tytułów i organu:** P7 w `builder.py`.
4. **Linter jakości i testy regresyjne:** sekcje 4.1–4.3. Dopiero z nimi mierzymy skutek P1.
5. **Ekstrakcja 8 i 9:** P1, z podziałem na klasyfikację wiersza, zgody i strony alternatywne.
6. **Przegenerowanie `outputs/`, raport, przegląd ręczny, tag.**

Każdy punkt powinien być osobnym commitem w konwencji repozytorium (`fix(api): …`, `test(api): …`, `docs(docs): …`).

## 6. Otwarte pytania

- Czy istnieje treść zadania z kryteriami punktacji? Jeśli tak, wpisać jej wymagania do sekcji 3 i 4.
- Czy sędzia importuje JSON do prawdziwego Generatora Formularzy, czy ocenia go ręcznie? To wpływa na wagę P5 (`INFO_SECTION`).
- Czy mają być obsłużone wszystkie ścieżki podmiotu wniosku w formularzach, w których papier nie przewiduje podmiotu zbiorowego (np. nr 3, 7)?
- Czy adres ma być jednym polem `TERYT_4G_DOWODOWY` (jak wzorzec), czy czterema listami (jak standard)?

## 7. Status wdrożenia

Stan na 2026-11-22. Zmiany nie są zacommitowane.

**Zrobione (z testami):**
- **P2, P3 (częściowo):** walidatory `REQUIRED`, `PESEL`, `NIP`, `REGON`, `ZIP_CODE`, `EMAIL` w szablonie. Dodane pola: REGON, Numer KRS (opcjonalny, bez wzorca, bo schemat nie ma walidatora wzorca), PESEL innej osoby.
- **P5:** strona końcowa używa `INFO_SECTION`. `TEXT_BLOCK` na stronie końcowej jest tylko ostrzeżeniem walidatora, bo wzorce organizatora go używają.
- **P6:** zgoda bez martwego linku. Adres klauzuli ustawia zmienna `CLAUSE_URL`, a bez niej zostaje sam tekst.
- **P7, P8:** „WNIOSEK” → „Wniosek”, „Nazwa organu” dla Wójta, Prezydenta i podobnych, usuwanie białych znaków i `\n` z etykiet, brakujący `techName` opcji „Reprezentant”, literówka „pełnomonictwo”.
- **P9, 4.1:** twarde reguły walidatora (`flow`, stany, odwołania jsonaty, strona końcowa, słowniki) i moduł `app/coi/quality.py` z ostrzeżeniami jakości, podpięty do `outputs/raport.json`.
- **Błędy znalezione przy okazji:**
  - ukryte sekcje nie znikały u obywatela, bo mapowanie pomijało stany sekcji (dodane `visibleWhen`, warunki `allOf` i `anyOf`),
  - zmiana nazwy strony w edytorze psuła stany sekcji,
  - zgody w mapowaniu dla obywatela były pomijane (teraz wymagane checkboxy).
- **P1 (częściowo):** nagłówki z etykiet pól (PESEL, TAK NIE) nie otwierają już sekcji, długie zdania nie są opcjami, a oświadczenia i zgody trafiają do `CONSENT_SECTION`.
- `outputs/` przegenerowane. Formularze 1–7: 0 błędów i 0 ostrzeżeń jakości.

**Nie zrobione:**
- **P1, semantyka 8 i 9:** wielkie sekcje (do 38 pól), strony „Pesel” i „Gdynia”, brak pola „rodzaj wniosku” i stron alternatywnych dla formularza łączącego 3 wnioski. Wymaga osobnej pracy (kroki 2–5 z sekcji 3, P1), prawdopodobnie z LLM.
- **P3, checkboxy:** „Brak nazwy ulicy” i „Brak numeru lokalu” nie są dodane. Ulica i numer lokalu są nieobowiązkowe.
- **P4:** pola `MLPZ` z adresu zostają edytowalne (decyzja do potwierdzenia).
- **Znalezione, nienaprawione:** pola `FILE_UPLOADER` nie trafiają do schematu obywatela (frontend nie ma typu „plik”), więc pełnomocnictwo i potwierdzenie opłaty nie da się dołączyć.
- Testy e2e i sprawdzenie w przeglądarce.
- Sekcje 4.2 (testy względem wzorców), 4.6–4.8 (słowniki, lint językowy, WCAG) i 4.10 (`check:outputs`).
