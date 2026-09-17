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
  const stderr = result.stderr;
  const standardError = stderr === null ? "" : stderr.toString("utf8").trim();
  const error = result.error;
  if (error !== undefined || result.status === null) {
    const detail = error === undefined ? standardError : error.message;
    throw createTsumoError(
      startDiagnosticCode,
      detail === ""
        ? `Failed to start ${toolName} '${executable}'`
        : `Failed to start ${toolName} '${executable}': ${detail}`,
    );
  }
  return new ExternalProcessResult(result.status as int32, standardError);
};
