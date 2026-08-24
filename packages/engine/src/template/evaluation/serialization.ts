import { parse as parseNodeUrl } from "node:url";
import { createTsumoError } from "../../diagnostics.js";
import { substringCount, substringFrom } from "../../utils/strings.js";
import { TextBuilder } from "../../utils/text-builder.js";
import { AnyArrayValue, BoolValue, DateValue, DictValue, HtmlValue, NilValue, NumberValue, StringValue, TemplateValue } from "../values.js";
import { ParsedUrl } from "../values/url.js";

export const getPathExtension = (path: string): string => {
  const lastDot = path.lastIndexOf(".");
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastDot < 0 || lastDot <= lastSlash) return "";
  return substringFrom(path, lastDot);
};

export const toJson = (value: TemplateValue): string => {
  if (value instanceof NilValue) return "null";
  if (value instanceof BoolValue) return value.value ? "true" : "false";
  if (value instanceof NumberValue) return `${value.value}`;
  if (value instanceof StringValue) return toJsonString(value.value);
  if (value instanceof DateValue) return toJsonString(value.value);
  if (value instanceof HtmlValue) return toJsonString(value.value.value);
  if (value instanceof AnyArrayValue) {
    const items = value.value;
    const sb = new TextBuilder();
    sb.append("[");
    let first = true;
    for (let i = 0; i < items.length; i++) {
      if (!first) sb.append(",");
      first = false;
      sb.append(toJson(items[i]!));
    }
    sb.append("]");
    return sb.toString();
  }
  if (value instanceof DictValue) {
    const sb = new TextBuilder();
    sb.append("{");
    let first = true;
    for (const k of value.value.keys()) {
      const v = value.value.get(k);
      if (v === undefined) continue;
      if (!first) sb.append(",");
      first = false;
      sb.append(toJsonString(k));
      sb.append(":");
      sb.append(toJson(v));
    }
    sb.append("}");
    return sb.toString();
  }
  return "null";
};

export const toJsonString = (value: string): string => {
  const sb = new TextBuilder();
  sb.append("\"");
  for (let i = 0; i < value.length; i++) {
    const ch = substringCount(value, i, 1);
    if (ch === "\\") sb.append("\\\\");
    else if (ch === "\"") sb.append("\\\"");
    else if (ch === "\n") sb.append("\\n");
    else if (ch === "\r") sb.append("\\r");
    else if (ch === "\t") sb.append("\\t");
    else sb.append(ch);
  }
  sb.append("\"");
  return sb.toString();
};

export const parseUrl = (value: string): ParsedUrl => {
  const trimmed = value.trim();
  if (trimmed.includes("\0")) {
    throw createTsumoError("TSUMO_TEMPLATE_URL_INVALID", `Invalid URL: ${value}`);
  }
  return new ParsedUrl(trimmed, parseNodeUrl(trimmed));
};

export const trimStartCharacter = (value: string, ch: string): string => {
  let start = 0;
  while (start < value.length && substringCount(value, start, 1) === ch) start++;
  return substringFrom(value, start);
};

export const trimEndCharacter = (value: string, ch: string): string => {
  let end = value.length;
  while (end > 0 && substringCount(value, end - 1, 1) === ch) end--;
  return substringCount(value, 0, end);
};

export const trimSlashes = (value: string): string => {
  const withoutLeading = trimStartCharacter(value, "/");
  return trimEndCharacter(withoutLeading, "/");
};

export const trimRightWhitespace = (s: string): string => {
  return s.trimEnd();
};
