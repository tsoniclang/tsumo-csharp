import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

export const createTestDirectory = (name: string): string => {
  const configuredRoot = process.env["TSUMO_TEST_ROOT"];
  if (configuredRoot === undefined || configuredRoot.trim() === "") {
    throw new Error("TSUMO_TEST_ROOT must name the test-owned scratch directory");
  }
  const root = resolve(configuredRoot);
  mkdirSync(root, { recursive: true });
  return mkdtempSync(join(root, `${name}-`));
};

export const createDirectory = (path: string): void => {
  mkdirSync(path, { recursive: true });
};

export const writeTextFile = (path: string, content: string): void => {
  writeFileSync(path, content, "utf8");
};

export const readTextFile = (path: string): string => readFileSync(path, "utf8");

export const pathExists = (path: string): boolean => existsSync(path);

export const directoryExists = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

export const fileExists = (path: string): boolean => existsSync(path) && statSync(path).isFile();

export const createSymbolicLink = (target: string, path: string): void => {
  symlinkSync(target, path);
};

export const deleteTestDirectory = (path: string): void => {
  rmSync(path, { recursive: true, force: true });
};
