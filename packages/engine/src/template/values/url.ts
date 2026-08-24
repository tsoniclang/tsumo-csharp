import type { UrlWithStringQuery } from "node:url";
import { TemplateValue } from "./base.js";

const trimLeadingCharacter = (value: string, character: string): string =>
  value.startsWith(character) ? value.slice(character.length) : value;

const trimTrailingCharacter = (value: string, character: string): string =>
  value.endsWith(character) ? value.slice(0, value.length - character.length) : value;

export class ParsedUrl {
  originalString: string;
  absolute: boolean;
  scheme: string;
  host: string;
  path: string;
  rawQuery: string;
  fragment: string;

  constructor(originalString: string, value: UrlWithStringQuery) {
    const protocol = value.protocol ?? "";
    const host = value.host ?? "";
    const pathname = value.pathname ?? "";
    const search = value.search ?? "";
    const hash = value.hash ?? "";
    this.originalString = originalString;
    this.absolute = protocol !== "";
    this.scheme = trimTrailingCharacter(protocol, ":");
    this.host = host;
    this.path = pathname;
    this.rawQuery = trimLeadingCharacter(search, "?");
    this.fragment = trimLeadingCharacter(hash, "#");
  }
}

export class UrlParts {
  path: string;
  rawQuery: string;
  fragment: string;

  constructor(path: string, rawQuery: string, fragment: string) {
    this.path = path;
    this.rawQuery = rawQuery;
    this.fragment = fragment;
  }
}

export class UrlValue extends TemplateValue {
  value: ParsedUrl;

  constructor(value: ParsedUrl) {
    super();
    this.value = value;
  }
}

export class UrlQueryValue extends TemplateValue {
  value: Map<string, string[]>;

  constructor(value: Map<string, string[]>) {
    super();
    this.value = value;
  }
}
