import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { repoRoot } from "./helpers.mjs";

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repoRoot, encoding: "utf8" },
).split("\0").filter((path) => path !== "" && existsSync(join(repoRoot, path)));

const sourceFiles = repositoryFiles.filter((path) =>
  /^packages\/(?:cli|engine|tests)\/src\/.*\.ts$/u.test(path)
);
const productSourceFiles = sourceFiles.filter((path) =>
  /^packages\/(?:cli|engine)\/src\/.*\.ts$/u.test(path)
);

test("authored TypeScript modules stay within the reviewed size boundary", () => {
  const oversized = sourceFiles.flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const lineCount = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    return lineCount > 600 ? [`${path}: ${lineCount} lines`] : [];
  });
  assert.deepEqual(oversized, []);
});

test("product source contains no retired Tsonic mechanisms", () => {
  const patterns = [
    ["retired Node module", /@tsonic\/nodejs\//u],
    ["retired generated binding package", /(?:markdig-types|photo-sauce-magic-scaler-types|xunit-types|@tsonic\/tsbindgen)/u],
    ["target-specific primitive module", /@tsonic\/(?:csharp|rust)\/types\.js/u],
    ["target-flavored neutral primitive alias", /\bint32\s+as\s+int\b/u],
    ["retired cast marker", /\b(?:trycast|asinterface|attributes)\s*(?:<|\()/u],
    ["TypeScript source import", /(?:from\s+|import\s*\()\s*["'][^"']+\.ts["']/u],
    ["CommonJS module operation", /\brequire\s*\(|\bmodule\.exports\b|\bexport\s*=/u],
    ["triple-slash reference", /^\s*\/\/\/\s*<reference\b/u],
    ["TypeScript namespace", /^\s*(?:export\s+)?namespace\s+/u],
    ["explicit class accessibility", /^\s*(?:public|private|protected)\s+/u],
    ["TypeScript override modifier", /^\s*override\s+/u],
    ["runtime reflection", /\b(?:System\.Reflection|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load|GetProperties?\s*\(|GetMethods?\s*\()/u],
    ["unfinished product marker", /\b(?:TODO|FIXME|HACK)\b|\bbest[- ]effort\b|\bFor now\b/u],
  ];
  const violations = [];
  for (const path of sourceFiles) {
    const lines = readFileSync(join(repoRoot, path), "utf8").split("\n");
    for (let index = 0; index < lines.length; index++) {
      for (const [label, pattern] of patterns) {
        if (pattern.test(lines[index])) {
          violations.push(`${path}:${index + 1}: ${label}: ${lines[index].trim()}`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("product source does not bypass shared recursive filesystem traversal", () => {
  const violations = productSourceFiles.flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    return /Directory\.(?:Get|Enumerate)(?:Files|Directories)\(|SearchOption\.AllDirectories/u.test(text)
      ? [`${path}: bypasses shared recursive filesystem traversal`]
      : [];
  });
  assert.deepEqual(violations, []);
});

test("filesystem calls use standard Node option objects", () => {
  const violations = sourceFiles.flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    return /\b(?:mkdirSync|rmSync)\([^\n,]+,\s*(?:true|false)\s*\)/u.test(text)
      ? [`${path}: uses a provider-private boolean filesystem overload`]
      : [];
  });
  assert.deepEqual(violations, []);
});

test("target-native dependencies stay behind explicit C# platform boundaries", () => {
  const markdigModule = /^@tsonic\/dotnet\/Markdig(?:\.[A-Za-z0-9_.]+)?\.js$/u;
  const allowedModulesByProductFile = new Map([
    ["packages/engine/src/docs/markdown.ts", markdigModule],
    ["packages/engine/src/markdown/pipeline.ts", markdigModule],
    ["packages/engine/src/markdown/render-basic.ts", markdigModule],
    [
      "packages/engine/src/markdown/render-hooks.ts",
      /^(?:@tsonic\/dotnet\/Markdig(?:\.[A-Za-z0-9_.]+)?|@tsonic\/dotnet\/System\.(?:IO|Text))\.js$/u,
    ],
    ["packages/engine/src/markdown/render-with-shortcodes.ts", markdigModule],
    ["packages/engine/src/markdown/toc.ts", markdigModule],
    ["packages/engine/src/resources/image-provider.ts", /^@tsonic\/dotnet\/PhotoSauce\.[A-Za-z0-9_.]+\.js$/u],
    ["packages/engine/src/utils/html.ts", /^@tsonic\/dotnet\/System\.Net\.js$/u],
    ["packages/engine/src/utils/text-builder.ts", /^@tsonic\/dotnet\/System\.Text\.js$/u],
  ]);
  const violations = [];
  for (const path of productSourceFiles) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    for (const match of text.matchAll(/(?:from\s+|import\s*\()\s*["'](@tsonic\/dotnet\/[^"']+)["']/gu)) {
      const allowedModule = allowedModulesByProductFile.get(path);
      if (allowedModule === undefined || !allowedModule.test(match[1])) {
        violations.push(`${path}: imports ${match[1]} outside a C# platform boundary`);
      }
    }
    if (
      !allowedModulesByProductFile.has(path) &&
      /\b(?:JsonDocument|JsonElement|MagicImageProcessor|MarkdownDocument|Regex|StringBuilder|WebUtility)\b/u.test(text)
    ) {
      violations.push(`${path}: references a C# platform type outside its boundary`);
    }
  }
  for (const path of sourceFiles.filter((candidate) => candidate.startsWith("packages/tests/src/"))) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    for (const match of text.matchAll(/(?:from\s+|import\s*\()\s*["'](@tsonic\/dotnet\/[^"']+)["']/gu)) {
      if (match[1] !== "@tsonic/dotnet/Xunit.js") {
        violations.push(`${path}: test imports non-Xunit target API ${match[1]}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("portable external-tool orchestration uses the Node capability", () => {
  const resources = join(repoRoot, "packages/engine/src/resources");
  const externalProcess = readFileSync(join(resources, "external-process.ts"), "utf8");
  assert.match(externalProcess, /from\s+["']node:child_process["']/u);
  assert.match(externalProcess, /\bspawnSync\s*\(/u);
  for (const fileName of ["sass-provider.ts", "javascript-provider.ts"]) {
    const text = readFileSync(join(resources, fileName), "utf8");
    assert.match(text, /runExternalProcess\s*\(/u, fileName);
    assert.doesNotMatch(text, /@tsonic\/dotnet\/|\bProcess(?:StartInfo)?\b/u, fileName);
  }
});

test("regular expression helpers use only the shared JavaScript contract", () => {
  const source = readFileSync(
    join(repoRoot, "packages/engine/src/utils/regular-expressions.ts"),
    "utf8",
  );
  assert.match(source, /new RegExp\(/u);
  assert.match(source, /\.matchAll\(/u);
  assert.doesNotMatch(source, /@tsonic\/dotnet\/|@tsonic\/rust\//u);
});

test("locked restores exclude SDK-local package substitutes", () => {
  const buildProperties = readFileSync(join(repoRoot, "Directory.Build.props"), "utf8");
  assert.match(
    buildProperties,
    /<DisableImplicitLibraryPacksFolder>true<\/DisableImplicitLibraryPacksFolder>/u,
  );
});

test("compiler projects use one current source and target contract", () => {
  const projectNames = ["engine", "cli", "tests"];
  for (const projectName of projectNames) {
    const projectRoot = join(repoRoot, "packages", projectName);
    const manifest = readJson(join(projectRoot, "package.json"));
    const config = readJson(join(projectRoot, "tsonic.json"));
    assert.equal(manifest.type, "module", projectName);
    assert.equal(manifest.devDependencies["@tsonic/cli"].startsWith("file:"), true, projectName);
    assert.equal(manifest.devDependencies["@tsonic/target-csharp"].startsWith("file:"), true, projectName);
    assert.equal(manifest.devDependencies["@tsonic/csharp-nodejs"].startsWith("file:"), true, projectName);
    assert.equal(config.entryPoint.endsWith(".ts"), true, projectName);
    assert.equal(config.rootDir, "src", projectName);
    assert.equal(config.outDir, "out", projectName);
    assert.equal(config.targets.length, 1, projectName);
    assert.equal(config.targets[0].id, "csharp", projectName);
    assert.deepEqual(config.targets[0].surfaces, ["js"], projectName);
    assert.equal(typeof config.targets[0].options.projectFile, "string", projectName);
    assert.equal(config.targets[0].options.providerReferences.directories.length > 0, true, projectName);
  }

  const engineManifest = readJson(join(repoRoot, "packages/engine/package.json"));
  assert.equal(engineManifest.exports["./index.js"], "./src/index.ts");
  assert.equal(engineManifest.exports["."], undefined);
});

test("retired project configuration cannot return", () => {
  const projectFiles = repositoryFiles.filter((path) =>
    /(?:package\.json|tsonic[^/]*\.json|\.csproj|\.sh)$/u.test(path)
  );
  const patterns = [
    /\btsonic\s+(?:restore|run|test)\b/u,
    /\b(?:sourceRoot|outputDirectory|rootNamespace|buildOptions)\b/u,
    /generated\/tsonic\.csproj/u,
    /tsonic\.package\.json|tsonic\.workspace\.json|tsonic\.aot\.json/u,
  ];
  const violations = [];
  for (const path of projectFiles) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    for (const pattern of patterns) {
      if (pattern.test(text)) violations.push(`${path}: ${pattern.source}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("generated and investigation artifacts remain untracked and ignored", () => {
  const forbiddenTracked = repositoryFiles.filter((path) =>
    path.startsWith(".analysis/") ||
    path.startsWith(".temp/") ||
    /(^|\/)public\d*(\/|$)/u.test(path) ||
    /\/(?:out|dist|bin|obj|node_modules)\//u.test(`/${path}/`) ||
    path.endsWith(".dll")
  );
  assert.deepEqual(forbiddenTracked, []);
  for (const path of [".analysis/probe.md", ".temp/probe", "packages/engine/out/probe.cs"]) {
    const ignored = execFileSync("git", ["check-ignore", path], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    assert.equal(ignored, path);
  }
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
