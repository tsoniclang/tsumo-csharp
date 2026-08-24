import { LayoutEnvironment } from "./layouts.js";
import { ResourceManager } from "./resources.js";
import { ModuleMount } from "./models.js";
import { env } from "node:process";
import { fileExists } from "./fs.js";
import { resolveContainedResourcePath } from "./resources/paths.js";
import { loadSiteData } from "./template/data-loader.js";

export class BuildEnvironment extends LayoutEnvironment {
  siteDir: string;
  themeDir: string | undefined;
  outputDir: string;
  resources: ResourceManager;

  constructor(siteDir: string, themeDir: string | undefined, outputDir: string, mounts?: ModuleMount[], buildTime?: Date) {
    super(siteDir, themeDir, mounts, buildTime, loadSiteData(siteDir, themeDir, mounts));
    this.siteDir = siteDir;
    this.themeDir = themeDir;
    this.outputDir = outputDir;
    this.resources = new ResourceManager(siteDir, themeDir, outputDir);
  }

  getResourceManager(): ResourceManager | undefined {
    return this.resources;
  }

  getEnvironmentVariable(name: string): string | undefined {
    return env[name];
  }

  sourceFileExists(path: string): boolean {
    return fileExists(resolveContainedResourcePath(this.siteDir, path));
  }
}
