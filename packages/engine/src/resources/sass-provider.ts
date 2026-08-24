import { Buffer } from "node:buffer";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { createTsumoError } from "../diagnostics.js";
import { dirExists } from "../fs.js";
import { Resource } from "./models.js";
import { runExternalProcess } from "./external-process.js";
import { splitResourceFileName, splitResourcePath } from "./paths.js";
import { readResourceText } from "./text.js";

export const compileSassResource = (
  resource: Resource,
  loadPaths: string[],
): Resource => {
  const sourceText = readResourceText(resource, "css.Sass");

  const configuredExecutable = env["TSUMO_SASS"];
  const executable = configuredExecutable !== undefined && configuredExecutable.trim() !== ""
    ? configuredExecutable.trim()
    : "sass";
  const configuredImplementation = env["TSUMO_SASS_IMPLEMENTATION"];
  const implementation = configuredImplementation === undefined || configuredImplementation.trim() === ""
    ? "dart-sass"
    : configuredImplementation.trim().toLowerCase();
  if (implementation !== "dart-sass" && implementation !== "libsass") {
    throw createTsumoError(
      "TSUMO_SASS_IMPLEMENTATION_INVALID",
      `Unsupported Sass implementation '${implementation}'; expected 'dart-sass' or 'libsass'`,
    );
  }
  const workDirectory = mkdtempSync(join(tmpdir(), "tsumo-sass-"));

  try {
    const inputPath = join(workDirectory, "input.scss");
    const outputPath = join(workDirectory, "output.css");
    writeFileSync(inputPath, sourceText, "utf8");

    const argumentsList: string[] = implementation === "dart-sass"
      ? ["--no-source-map", "--style", "expanded"]
      : ["-t", "expanded"];
    for (let index = 0; index < loadPaths.length; index++) {
      const loadPath = loadPaths[index]!;
      if (!dirExists(loadPath)) continue;
      argumentsList.push(implementation === "dart-sass" ? "--load-path" : "-I");
      argumentsList.push(loadPath);
    }
    argumentsList.push(inputPath);
    argumentsList.push(outputPath);

    const process = runExternalProcess(executable, argumentsList, "Sass compiler", "TSUMO_SASS_START_FAILED");
    if (process.exitCode !== 0) {
      const stderr = process.standardError;
      throw createTsumoError(
        "TSUMO_SASS_FAILED",
        stderr === "" ? `Sass compiler failed with exit code ${process.exitCode}` : stderr,
      );
    }
    if (!existsSync(outputPath)) {
      throw createTsumoError("TSUMO_SASS_OUTPUT_MISSING", "Sass compiler completed without producing CSS");
    }

    const text = readFileSync(outputPath, "utf8");
    const outputPathRaw = resource.outputRelPath ?? "style.scss";
    const path = splitResourcePath(outputPathRaw);
    const file = splitResourceFileName(path.fileName);
    return new Resource(
      `${resource.id}|sass`,
      resource.sourcePath,
      true,
      path.directory + file.baseName + ".css",
      Buffer.from(text, "utf8"),
      text,
      resource.Data,
      "text/css",
    );
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
};
