import type { int32 } from "@tsonic/core/types.js";
import { createTsumoError } from "../../diagnostics.js";
import {
  JsonArray, JsonBool, JsonNull, JsonNumber, JsonObject, JsonString, JsonValue,
} from "../../utils/json.js";
import {
  AnyArrayValue, BoolValue, DictValue, NumberValue, StringValue, TemplateValue,
} from "../values.js";
import { nil } from "../runtime-helpers.js";

export const jsonToTemplateValue = (value: JsonValue): TemplateValue => {
  if (value instanceof JsonNull) return nil;
  if (value instanceof JsonBool) return new BoolValue(value.value);
  if (value instanceof JsonNumber) {
    if (!Number.isInteger(value.value) || value.value < -2147483648 || value.value > 2147483647) {
      throw createTsumoError(
        "TSUMO_TEMPLATE_UNMARSHAL_NUMBER_UNSUPPORTED",
        "Structured template data currently requires 32-bit integer numbers",
        undefined,
        value.line,
        value.column,
      );
    }
    return new NumberValue(value.value as int32);
  }
  if (value instanceof JsonString) return new StringValue(value.value);
  if (value instanceof JsonArray) {
    const items: TemplateValue[] = [];
    for (let index = 0; index < value.items.length; index++) {
      items.push(jsonToTemplateValue(value.items[index]!));
    }
    return new AnyArrayValue(items);
  }
  if (value instanceof JsonObject) {
    const fields = new Map<string, TemplateValue>();
    for (let index = 0; index < value.properties.length; index++) {
      const property = value.properties[index]!;
      fields.set(property.key, jsonToTemplateValue(property.value));
    }
    return new DictValue(fields);
  }
  throw createTsumoError("TSUMO_TEMPLATE_UNMARSHAL_VALUE_INVALID", "Structured data contains an unknown value kind");
};
