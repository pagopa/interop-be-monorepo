import dotenvFlow from "dotenv-flow";
import { join } from "node:path";

import {
  ENVIRONMENT_KEYS,
  ENVIRONMENT_RULES,
  LOCAL_LOOPBACK_HOSTS,
  PACKAGE_LAYOUT,
} from "../config/constants.js";
import {
  localEnvironmentOverrides,
  packageEnvironmentOverrides,
} from "../config/localEnvironment.js";
import { directoryForName } from "../utilities/packageUtils.js";

const localHost = (value: string): boolean =>
  LOCAL_LOOPBACK_HOSTS.includes(value);

const envFiles = (path: string): string[] =>
  dotenvFlow.listFiles({ path, node_env: ENVIRONMENT_RULES.nodeEnvironment });

const env = (path: string): Record<string, string> =>
  dotenvFlow.parse(envFiles(path));

const isHostSetting = (key: string): boolean =>
  ENVIRONMENT_RULES.hostSuffixes.some((suffix) => key.endsWith(suffix)) &&
  !key.endsWith(ENVIRONMENT_RULES.serverHostSuffix);

const isEndpointSetting = (key: string): boolean => {
  // Callbacks are browser redirects, not outgoing service integrations.
  if (
    key.includes(ENVIRONMENT_RULES.callbackFragment) ||
    key === ENVIRONMENT_KEYS.ignoreConfiguredEndpoints
  )
    return false;

  return (
    ENVIRONMENT_RULES.urlSuffix.test(key) ||
    key.includes(ENVIRONMENT_RULES.endpointFragment) ||
    key.endsWith(ENVIRONMENT_RULES.serverHostSuffix)
  );
};

const validateEndpoint = (key: string, origin: string): void => {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`${key} has no configured local HTTP adapter: ${origin}`);
  }
  if (
    url.protocol !== ENVIRONMENT_RULES.localProtocol ||
    !localHost(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error(`${key} must use an HTTP local loopback endpoint`);
};

const validateSetting = ([key, setting]: [
  string,
  string | undefined,
]): void => {
  if (!setting) return;
  if (isHostSetting(key) && !localHost(setting)) {
    throw new Error(`${key} must use a local loopback host`);
  }
  if (
    key.endsWith(ENVIRONMENT_RULES.kafkaBrokersSuffix) &&
    setting.split(",").some((broker) => !localHost(broker.split(":")[0]))
  )
    throw new Error(`${key} must use local Kafka brokers`);

  if (isEndpointSetting(key)) {
    setting.split(",").forEach((origin) => validateEndpoint(key, origin));
  }
};

export const localEnvironment = async (
  root: string,
  name: string
): Promise<NodeJS.ProcessEnv> => {
  const directory = await directoryForName(root, name);

  const value = effectiveEnvironment(root, directory, name);
  Object.entries(value).forEach(validateSetting);

  return value;
};

export const effectiveEnvironment = (
  root: string,
  directory: string,
  name: string
): NodeJS.ProcessEnv => ({
  ...env(join(root, PACKAGE_LAYOUT.directory, directory)),
  ...packageEnvironmentOverrides[name],
  ...localEnvironmentOverrides,
});
