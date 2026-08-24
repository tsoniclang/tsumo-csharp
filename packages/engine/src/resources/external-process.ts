import type { int32 } from "@tsonic/core/types.js";
import { spawnSync } from "node:child_process";
import { createTsumoError } from "../diagnostics.js";

export class ExternalProcessResult {
  exitCode: int32;
  standardError: string;

  constructor(exitCode: int32, standardError: string) {
    this.exitCode = exitCode;
    this.standardError = standardError;
  }
}

export const runExternalProcess = (
  executable: string,
  argumentsList: string[],
  toolName: string,
  startDiagnosticCode: string,
): ExternalProcessResult => {
  const result = spawnSync(executable, argumentsList);
  const standardError = result.stderr.toString("utf8").trim();
  if (result.status === null) {
    throw createTsumoError(
      startDiagnosticCode,
      standardError === ""
        ? `Failed to start ${toolName} '${executable}'`
        : `Failed to start ${toolName} '${executable}': ${standardError}`,
    );
  }
  return new ExternalProcessResult(result.status as int32, standardError);
};
