import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { repoRoot } from "./helpers.mjs";

test("generation workers are bounded, configurable and collect every project", () => {
  const temporary = join(repoRoot, ".temp", "concurrency-tests");
  mkdirSync(temporary, { recursive: true });
  for (const workers of [1, 2]) {
    const root = mkdtempSync(join(temporary, "workers-"));
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(repoRoot, "scripts", "build-tsonic.sh"), join(root, "scripts", "build-tsonic.sh"));
    for (const name of ["engine", "cli", "tests"]) mkdirSync(join(root, "packages", name), { recursive: true });
    const cli = join(root, "node_modules", "@tsonic", "cli", "dist", "src");
    mkdirSync(cli, { recursive: true });
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "node_modules", "@tsonic", "cli", "package.json"), '{"type":"module"}');
    writeFileSync(join(cli, "index.js"), `
import { appendFileSync, readFileSync } from "node:fs";
import { basename } from "node:path";
const path = process.env.EVENTS;
const name = basename(process.cwd());
appendFileSync(path, JSON.stringify({ event: "start", name }) + "\\n");
while (readFileSync(path, "utf8").split("\\n").filter(line => line.includes('"start"')).length < Number(process.env.WORKERS)) {
  await new Promise(resolve => setTimeout(resolve, 10));
}
appendFileSync(path, JSON.stringify({ event: "end", name }) + "\\n");
`);
    const events = join(root, "events.jsonl");
    const environment = { ...process.env, EVENTS: events, WORKERS: String(workers),
      TSUMO_TSONIC_WORKERS: String(workers), TSUMO_BUILD_LOG_DIR: join(root, "logs") };
    execFileSync("bash", [join(root, "scripts", "build-tsonic.sh")], {
      env: environment, timeout: 30_000, stdio: "pipe",
    });
    let active = 0;
    let peak = 0;
    const completed = [];
    for (const event of readFileSync(events, "utf8").trim().split("\n").map(line => JSON.parse(line))) {
      active += event.event === "start" ? 1 : -1;
      peak = Math.max(peak, active);
      assert.ok(active >= 0 && active <= workers);
      if (event.event === "end") completed.push(event.name);
    }
    assert.equal(active, 0);
    assert.equal(peak, workers);
    assert.deepEqual(completed.sort(), ["cli", "engine", "tests"]);
    const invalid = spawnSync("bash", [join(root, "scripts", "build-tsonic.sh")], {
      env: { ...environment, TSUMO_TSONIC_WORKERS: "0" }, encoding: "utf8", timeout: 30_000,
    });
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /must be a positive integer/u);
  }
});
