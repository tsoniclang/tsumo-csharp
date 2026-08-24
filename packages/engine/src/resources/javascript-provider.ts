import { Buffer } from "node:buffer";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { createTsumoError } from "../diagnostics.js";
import { fileExists, readTextFile } from "../fs.js";
import { Resource } from "./models.js";
import { runExternalProcess } from "./external-process.js";
import { splitResourceFileName, splitResourcePath } from "./paths.js";
import { readResourceText } from "./text.js";

const cacheKeyPart = (value: string): string => `${value.length}:${value}`;

export class JavaScriptBuildOptions {
  targetPath: string | undefined;
  minify: boolean;
  format: string;
  target: string;
  platform: string;
  sourceMap: string;
  paramsJson: string | undefined;
  jsxFactory: string | undefined;

  constructor() {
    this.targetPath = undefined;
    this.minify = false;
    this.format = "iife";
    this.target = "esnext";
    this.platform = "browser";
    this.sourceMap = "none";
    this.paramsJson = undefined;
    this.jsxFactory = undefined;
  }

  cacheKey(): string {
    const values = [
      this.targetPath ?? "",
      this.minify ? "1" : "0",
      this.format,
      this.target,
      this.platform,
      this.sourceMap,
      this.paramsJson ?? "",
      this.jsxFactory ?? "",
    ];
    let result = "";
    for (let index = 0; index < values.length; index++) {
      result += cacheKeyPart(values[index]!);
    }
    return result;
  }
}

const sourceExtension = (resource: Resource): string => {
  const raw = resource.outputRelPath ?? resource.sourcePath ?? "input.js";
  const extension = splitResourceFileName(splitResourcePath(raw).fileName).extension.toLowerCase();
  if (extension === ".ts" || extension === ".tsx" || extension === ".jsx") return extension;
  return ".js";
};

const outputRelativePath = (resource: Resource, options: JavaScriptBuildOptions): string => {
  const raw = options.targetPath ?? resource.outputRelPath ?? "script.js";
  const path = splitResourcePath(raw);
  const file = splitResourceFileName(path.fileName);
  return path.directory + file.baseName + ".js";
};

export const buildJavaScriptResource = (
  resource: Resource,
  options: JavaScriptBuildOptions,
): Resource => {
  const sourceText = readResourceText(resource, "js.Build");
  if (options.sourceMap !== "none") {
    throw createTsumoError(
      "TSUMO_JAVASCRIPT_SOURCE_MAP_UNSUPPORTED",
      "js.Build currently supports only sourceMap 'none'",
    );
  }

  const configuredExecutable = env["TSUMO_ESBUILD"];
  const executable = configuredExecutable !== undefined && configuredExecutable.trim() !== ""
    ? configuredExecutable.trim()
    : "esbuild";
  const workDirectory = mkdtempSync(join(tmpdir(), "tsumo-esbuild-"));

  try {
    let inputPath = join(workDirectory, "input" + sourceExtension(resource));
    const sourcePath = resource.sourcePath;
    if (sourcePath !== undefined && fileExists(sourcePath) && readTextFile(sourcePath) === sourceText) {
      inputPath = sourcePath;
    } else {
      writeFileSync(inputPath, sourceText, "utf8");
    }
    const outputPath = join(workDirectory, "output.js");
    const argumentsList: string[] = [
      inputPath,
      "--bundle",
      `--outfile=${outputPath}`,
      `--format=${options.format}`,
      `--target=${options.target}`,
      `--platform=${options.platform}`,
      "--charset=utf8",
      "--log-level=warning",
    ];
    if (options.minify) argumentsList.push("--minify");
    const jsxFactory = options.jsxFactory;
    if (jsxFactory !== undefined) argumentsList.push(`--jsx-factory=${jsxFactory}`);
    const paramsJson = options.paramsJson;
    if (paramsJson !== undefined) {
      const paramsPath = join(workDirectory, "params.json");
      writeFileSync(paramsPath, paramsJson, "utf8");
      argumentsList.push(`--alias:@params=${paramsPath}`);
    }

    const process = runExternalProcess(executable, argumentsList, "esbuild", "TSUMO_ESBUILD_START_FAILED");
    if (process.exitCode !== 0) {
      throw createTsumoError(
        "TSUMO_ESBUILD_FAILED",
        process.standardError === "" ? `esbuild failed with exit code ${process.exitCode}` : process.standardError,
      );
    }
    if (!existsSync(outputPath)) {
      throw createTsumoError("TSUMO_ESBUILD_OUTPUT_MISSING", "esbuild completed without producing JavaScript");
    }

    const text = readFileSync(outputPath, "utf8");
    return new Resource(
      `${resource.id}|js-build:${options.cacheKey()}`,
      resource.sourcePath,
      true,
      outputRelativePath(resource, options),
      Buffer.from(text, "utf8"),
      text,
      resource.Data,
      "application/javascript",
    );
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
};
