import { StringBuilder } from "@tsonic/dotnet/System.Text.js";
import type { int32 } from "@tsonic/core/types.js";

export class TextBuilder {
  #state: StringBuilder;

  constructor() {
    this.#state = new StringBuilder();
  }

  get length(): int32 {
    return this.#state.Length;
  }

  append(text: string): void {
    this.#state.Append(text);
  }

  toString(): string {
    return this.#state.ToString();
  }
}
