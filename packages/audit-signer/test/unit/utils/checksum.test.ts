import { Buffer } from "buffer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { genericInternalError } from "pagopa-interop-models";
import { calculateSha256Base64 } from "../../../src/utils/checksum.js";

describe("calculateSha256Base64", () => {
  const mockDigest = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: mockDigest,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should correctly calculate SHA-256 and return base64 string", async () => {
    const inputBuffer = Buffer.from("hello world");
    const expectedHashHex =
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
    const expectedHashBuffer = Buffer.from(expectedHashHex, "hex");
    mockDigest.mockResolvedValue(expectedHashBuffer);

    const result = await calculateSha256Base64(inputBuffer);

    expect(mockDigest).toHaveBeenCalledWith("SHA-256", inputBuffer);
    expect(result).toBe(expectedHashBuffer.toString("base64"));
  });

  it("should throw genericInternalError if crypto.subtle.digest fails", async () => {
    const inputBuffer = Buffer.from("test");
    const fakeError = new Error("digest failed");

    mockDigest.mockRejectedValue(fakeError);

    await expect(calculateSha256Base64(inputBuffer)).rejects.toEqual(
      genericInternalError(`Failed to calculate SHA-256 checksum: ${fakeError}`)
    );
  });
});
