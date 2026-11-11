import { KMSClient } from "@aws-sdk/client-kms";
import { InteropTokenGenerator } from "pagopa-interop-commons";

import { config } from "../config/config.js";

const generators = new WeakMap<KMSClient, InteropTokenGenerator>();

/**
 * Note: This function is left to its own file to enable mocking
 * or to override the KmsClient to use a local KmsClient like so:
 *
 * ```
 * const kmsClient = new KMSClient({
 *   endpoint: "http://localhost:4566",
 * });
 * ```
 */
export function getInteropTokenGenerator(
  kmsClient: KMSClient
): InteropTokenGenerator {
  // The generator is cached per KMS client so that a document download does not
  // build a new one on every request.
  const cachedGenerator = generators.get(kmsClient);
  if (cachedGenerator) {
    return cachedGenerator;
  }
  const generator = new InteropTokenGenerator(config, kmsClient);
  generators.set(kmsClient, generator);
  return generator;
}
