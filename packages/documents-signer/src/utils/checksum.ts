import { Buffer } from "buffer";
import { genericInternalError } from "pagopa-interop-models";

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
