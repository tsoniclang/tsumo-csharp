import { WebUtility } from "@tsonic/dotnet/System.Net.js";
import { replaceText } from "./strings.js";

export const escapeHtml = (input: string): string => {
  let s = input;
  s = replaceText(s, "&", "&amp;");
  s = replaceText(s, "<", "&lt;");
  s = replaceText(s, ">", "&gt;");
  s = replaceText(s, "\"", "&quot;");
  s = replaceText(s, "'", "&#39;");
  return s;
};

export const decodeHtml = (input: string): string => WebUtility.HtmlDecode(input) ?? "";

export class HtmlString {
  value: string;

  constructor(value: string) {
    this.value = value;
  }
}
