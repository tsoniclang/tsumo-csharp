import type { TemplateValue } from "../values.js";

export class TemplateReturnSignal extends Error {
  value: TemplateValue;

  constructor(value: TemplateValue) {
    super("template return");
    this.name = "TemplateReturnSignal";
    this.value = value;
  }
}
