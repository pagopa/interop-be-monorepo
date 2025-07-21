import { Buffer } from "buffer";
import { genericInternalError } from "pagopa-interop-models";

/**
 * Calculates the SHA-256 checksum of a given Buffer, encoded in Base64.
 * This function leverages the Web Crypto API, which is available in modern browsers and Node.js (v15+).
 *
 * @param dataBuffer The Buffer containing the data to be hashed.
 * @returns A Promise that resolves with the Base64-encoded SHA-256 checksum.
 * @throws {Error} If an error occurs during the SHA-256 hash calculation.
 */
export const calculateSha256Base64 = async (
  dataBuffer: Buffer
): Promise<string> => {
  try {
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashAsBuffer = Buffer.from(hashBuffer);
    return hashAsBuffer.toString("base64");
  } catch (error) {
    throw genericInternalError(
      `Failed to calculate SHA-256 checksum: ${error}`
    );
  }
};
