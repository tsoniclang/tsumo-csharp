import { UrlParts, UrlValue } from "../values.js";

export const splitUrlParts = (uri: UrlValue["value"]): UrlParts =>
  new UrlParts(uri.path, uri.rawQuery, uri.fragment);
