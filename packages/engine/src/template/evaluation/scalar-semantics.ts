import { parseInt32, toInt32 } from "../../utils/int32.js";
import { substringCount, zeroPadInteger } from "../../utils/strings.js";
import { TextBuilder } from "../../utils/text-builder.js";
import type { int32 } from "@tsonic/core/types.js";

export const isNumberLiteral = (token: string): boolean => {
  if (token === "") return false;
  return parseInt32(token) !== undefined;
};

const longWeekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const longMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const stripLeadingZero = (value: string): string => {
  return value.startsWith("0") ? value.slice(1) : value;
};

const weekdayIndex = (milliseconds: number): int32 => {
  let value = (Math.floor(milliseconds / 86400000) + 4) % 7;
  if (value < 0) value += 7;
  return value as int32;
};

export const addCalendarDate = (
  value: string,
  years: int32,
  months: int32,
  days: int32,
): string | undefined => {
  const milliseconds = Date.parse(value);
  if (Number.isNaN(milliseconds)) return undefined;
  const iso = new Date(milliseconds).toISOString();
  const sourceYear = parseInt32(substringCount(iso, 0, 4));
  const sourceMonth = parseInt32(substringCount(iso, 5, 2));
  const sourceDay = parseInt32(substringCount(iso, 8, 2));
  const hour = parseInt32(substringCount(iso, 11, 2));
  const minute = parseInt32(substringCount(iso, 14, 2));
  const second = parseInt32(substringCount(iso, 17, 2));
  const millisecond = parseInt32(substringCount(iso, 20, 3));
  if (
    sourceYear === undefined || sourceMonth === undefined || sourceDay === undefined ||
    hour === undefined || minute === undefined || second === undefined || millisecond === undefined
  ) return undefined;

  const sourceYearValue: number = sourceYear;
  const sourceMonthValue: number = sourceMonth;
  const yearsValue: number = years;
  const monthsValue: number = months;
  const totalMonths: number = sourceYearValue * 12 + sourceMonthValue - 1 + yearsValue * 12 + monthsValue;
  const targetYearValue: number = Math.floor(totalMonths / 12);
  if (targetYearValue < 1 || targetYearValue > 9999) return undefined;
  const targetYear = toInt32(targetYearValue);
  const targetMonth = toInt32(totalMonths - targetYearValue * 12);
  if (targetYear === undefined || targetMonth === undefined) return undefined;
  const yearText = zeroPadInteger(targetYear, 4);
  const monthText = zeroPadInteger(targetMonth + 1, 2);
  const hourText = zeroPadInteger(hour, 2);
  const minuteText = zeroPadInteger(minute, 2);
  const secondText = zeroPadInteger(second, 2);
  const millisecondText = zeroPadInteger(millisecond, 3);
  const monthStartText = yearText + "-" + monthText + "-01T" + hourText + ":" + minuteText + ":" +
    secondText + "." + millisecondText + "Z";
  const monthStart = Date.parse(monthStartText);
  if (Number.isNaN(monthStart)) return undefined;
  const sourceDayValue: number = sourceDay;
  const daysValue: number = days;
  const dayOffset: number = sourceDayValue - 1 + daysValue;
  const result = monthStart + dayOffset * 86400000;
  if (!Number.isFinite(result) || Math.abs(result) > 8640000000000000) return undefined;
  return new Date(result).toISOString();
};

export const isDateAfter = (left: string, right: string): boolean | undefined => {
  const leftMilliseconds = Date.parse(left);
  const rightMilliseconds = Date.parse(right);
  if (Number.isNaN(leftMilliseconds) || Number.isNaN(rightMilliseconds)) return undefined;
  return leftMilliseconds > rightMilliseconds;
};

export const formatDateTime = (value: string, layout: string): string | undefined => {
  const milliseconds = Date.parse(value);
  if (Number.isNaN(milliseconds)) return undefined;

  const iso = new Date(milliseconds).toISOString();
  const year = substringCount(iso, 0, 4);
  const month = substringCount(iso, 5, 2);
  const day = substringCount(iso, 8, 2);
  const hour24 = substringCount(iso, 11, 2);
  const minute = substringCount(iso, 14, 2);
  const second = substringCount(iso, 17, 2);
  const monthIndex = (parseInt32(month) ?? 1) - 1;
  const hourValue = parseInt32(hour24) ?? 0;
  const hour12Value = hourValue % 12 === 0 ? 12 : hourValue % 12;
  const hour12 = hour12Value < 10 ? `0${hour12Value}` : `${hour12Value}`;
  const weekday = weekdayIndex(milliseconds);
  const output = new TextBuilder();

  let index = 0;
  while (index < layout.length) {
    const remaining = layout.slice(index);
    if (remaining.startsWith("Monday")) {
      output.append(longWeekdays[weekday]!);
      index += 6;
    } else if (remaining.startsWith("January")) {
      output.append(longMonths[monthIndex]!);
      index += 7;
    } else if (remaining.startsWith("2006")) {
      output.append(year);
      index += 4;
    } else if (remaining.startsWith("Mon")) {
      output.append(shortWeekdays[weekday]!);
      index += 3;
    } else if (remaining.startsWith("Jan")) {
      output.append(shortMonths[monthIndex]!);
      index += 3;
    } else if (remaining.startsWith("PM")) {
      output.append(hourValue < 12 ? "AM" : "PM");
      index += 2;
    } else if (remaining.startsWith("pm")) {
      output.append(hourValue < 12 ? "am" : "pm");
      index += 2;
    } else if (remaining.startsWith("06")) {
      output.append(year.slice(2));
      index += 2;
    } else if (remaining.startsWith("01")) {
      output.append(month);
      index += 2;
    } else if (remaining.startsWith("02")) {
      output.append(day);
      index += 2;
    } else if (remaining.startsWith("15")) {
      output.append(hour24);
      index += 2;
    } else if (remaining.startsWith("03")) {
      output.append(hour12);
      index += 2;
    } else if (remaining.startsWith("04")) {
      output.append(minute);
      index += 2;
    } else if (remaining.startsWith("05")) {
      output.append(second);
      index += 2;
    } else if (remaining.startsWith("1")) {
      output.append(stripLeadingZero(month));
      index += 1;
    } else if (remaining.startsWith("2")) {
      output.append(stripLeadingZero(day));
      index += 1;
    } else if (remaining.startsWith("3")) {
      output.append(`${hour12Value}`);
      index += 1;
    } else {
      output.append(substringCount(layout, index, 1));
      index += 1;
    }
  }

  return output.toString();
};


/**
 * Dispatch a method call on a receiver value.
 * This handles method calls like `(resources.ByType "image").GetMatch "foo*"`
 * where we have a receiver value and a method name with arguments.
 */
