import { InteropTokenGenerator } from "pagopa-interop-commons";
import { KMSClient } from "@aws-sdk/client-kms";
import { config } from "../config/config.js";

const kmsClient = new KMSClient();

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
export function getIntoropTokenGenerator(): InteropTokenGenerator {
  return new InteropTokenGenerator(config, kmsClient);
}
