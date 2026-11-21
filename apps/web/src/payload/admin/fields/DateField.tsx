"use client";

import { Calendar, DateField as HeroDateField, DatePicker, I18nProvider } from "@heroui/react";
import { CalendarDate, parseAbsoluteToLocal, toCalendarDate, type ZonedDateTime } from "@internationalized/date";
import type { ClientField } from "payload";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";

type DateClientField = ClientField & { admin?: { date?: { pickerAppearance?: "dayAndTime" | "dayOnly" | "timeOnly" | "monthOnly" } } };

/** ISO z Payloada → wartość DatePickera (data albo data z godziną w strefie lokalnej). */
function toPickerValue(iso: unknown, dayOnly: boolean): CalendarDate | ZonedDateTime | null {
  if (typeof iso !== "string" || !iso) return null;
  try {
    const zoned = parseAbsoluteToLocal(new Date(iso).toISOString());
    return dayOnly ? toCalendarDate(zoned) : zoned;
  } catch {
    return null;
  }
}

/** Data bez godziny zapisujemy jako południe UTC – bez przesunięcia o dzień w innych strefach. */
function toIso(value: CalendarDate | ZonedDateTime | null, dayOnly: boolean): string | null {
  if (!value) return null;
  if (dayOnly || !("hour" in value)) return new Date(Date.UTC(value.year, value.month - 1, value.day, 12)).toISOString();
  return value.toDate().toISOString();
}

/** Data – HeroUI DatePicker (segmenty + kalendarz w popoverze), polski format. */
export function DateField(props: PanelFieldProps) {
  const field = props.field as DateClientField;
  const dayOnly = (field.admin?.date?.pickerAppearance ?? "dayAndTime") !== "dayAndTime";
  const f = usePanelField<string | null>(props);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  const value = toPickerValue(f.value, dayOnly);

  return (
    <FieldShell path={f.path} type="date" style={f.style} className={f.className} invalid={f.invalid}>
      <I18nProvider locale="pl-PL">
        <DatePicker
          id={id}
          name={f.path}
          value={value as never}
          onChange={(v: unknown) => f.setValue(toIso(v as CalendarDate | ZonedDateTime | null, dayOnly))}
          granularity={dayOnly ? "day" : "minute"}
          hourCycle={24}
          placeholderValue={dayOnly ? undefined : (parseAbsoluteToLocal(new Date().toISOString()).set({ hour: 9, minute: 0 }) as never)}
          isRequired={f.required}
          isReadOnly={f.readOnly}
          isInvalid={f.invalid}
          validationBehavior="aria"
          className="flex flex-col gap-1.5"
          aria-describedby={f.invalid ? errorId : undefined}
        >
          <PanelLabel required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
          <PanelDescription>{f.description}</PanelDescription>
          <HeroDateField.Group className="max-w-xs">
            <HeroDateField.Input className="tabular-nums">{(segment) => <HeroDateField.Segment segment={segment} />}</HeroDateField.Input>
            {!f.readOnly && (
              <HeroDateField.Suffix>
                <DatePicker.Trigger aria-label="Otwórz kalendarz">
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </HeroDateField.Suffix>
            )}
          </HeroDateField.Group>
          <DatePicker.Popover className="pf-popover">
            <Calendar aria-label={f.label ?? "Kalendarz"}>
              <Calendar.Header>
                <Calendar.NavButton slot="previous" />
                <Calendar.Heading />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </DatePicker.Popover>
        </DatePicker>
      </I18nProvider>
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}

