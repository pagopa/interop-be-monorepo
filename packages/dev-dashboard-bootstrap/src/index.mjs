import dotenvFlow from "dotenv-flow";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const nodeEnvironment = "development";

/**
 * Read dotenv files without inheriting or changing the launcher's environment.
 * @param {string} packagePath
 * @param {string} packageName
 * @returns {Record<string, string>}
 */
export const readPackageEnvironment = (packagePath, packageName) => {
  const value = dotenvFlow.parse(
    dotenvFlow.listFiles({ path: packagePath, node_env: nodeEnvironment })
  );
  // The local JWKS adapter already owns authorization-server's default port.
  if (packageName === "pagopa-interop-authorization-server") {
    value.PORT = "4700";
  }
  if (value.PORT) {
    const port = Number(value.PORT);
    if (
      !/^\d+$/.test(value.PORT) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65_535
    ) {
      throw new Error(
        `${packageName} PORT must be an integer between 1 and 65535: ${value.PORT}`
      );
    }
  }
  return value;
};

/**
 * @param {unknown} value
 * @returns {value is { name: string, scripts: { start: string } }}
 */
const hasStartScript = (value) =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  typeof value.name === "string" &&
  "scripts" in value &&
  typeof value.scripts === "object" &&
  value.scripts !== null &&
  "start" in value.scripts &&
  typeof value.scripts.start === "string" &&
  Boolean(value.scripts.start);

/** @param {string} source */
const hasExecutableSource = (source) =>
  Boolean(
    source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/export\s+\*(?:\s+as\s+[\w$]+)?\s+from\s+["'][^"']+["'];?/g, "")
      .replace(/export\s+\{[^}]*\}\s+from\s+["'][^"']+["'];?/g, "")
      .trim()
  );

/** @typedef {{ name: string, directory: string, port?: number }} RunnablePackage */

/**
 * @param {string} root
 * @param {string} directory
 * @returns {Promise<RunnablePackage | undefined>}
 */
const discoverPackage = async (root, directory) => {
  const packagePath = join(root, "packages", directory);
  /** @type {unknown} */
  let manifest;
  let source;
  try {
    manifest = JSON.parse(
      await readFile(join(packagePath, "package.json"), "utf8")
    );
    if (!hasStartScript(manifest)) return undefined;
    source = await readFile(join(packagePath, "src/index.ts"), "utf8");
  } catch {
    // Ignore non-workspace folders and packages without a readable entrypoint.
    return undefined;
  }
  if (!hasExecutableSource(source)) return undefined;

  const environment = readPackageEnvironment(packagePath, manifest.name);
  return {
    name: manifest.name,
    directory,
    ...(environment.PORT ? { port: Number(environment.PORT) } : {}),
  };
};

/**
 * @param {string} root
 * @returns {Promise<RunnablePackage[]>}
 */
export const discoverRunnablePackages = async (root) => {
  const entries = await readdir(join(root, "packages"), {
    withFileTypes: true,
  });
  const directories = entries
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith("dev-dashboard-")
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const packages = await Promise.all(
    directories.map((directory) => discoverPackage(root, directory.name))
  );
  return packages.filter((item) => item !== undefined);
};
