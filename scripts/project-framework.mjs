import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function projectFramework(packageName = "cli") {
  const config = JSON.parse(readFileSync(new URL(`../packages/${packageName}/tsonic.json`, import.meta.url), "utf8"));
  const selected = config.targets.find((target) => target.id === "csharp");
  if (selected === undefined) throw new Error(`No C# target in the ${packageName} project.`);
  return selected.options?.targetFramework ?? "net10.0";
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${projectFramework(process.argv[2])}\n`);
}
