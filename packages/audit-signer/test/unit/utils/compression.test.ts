import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import { zipBuffer } from "../../../src/utils/compression.js";

describe("compressJson", () => {
  it("should compress a Uint8Array into a valid zip buffer", async () => {
    const rawData = new TextEncoder().encode("binary data content");
    const fileName = "binary.bin";

    const result = await zipBuffer(rawData, fileName);

    const zip = new AdmZip(result);
    const entries = zip.getEntries();

    expect(entries[0].entryName).toBe(fileName);
    const fileBuffer = zip.readFile(entries[0]);
    if (!fileBuffer) {
      throw new Error("Expected zipped file content to be readable");
    }
    expect(fileBuffer.toString()).toBe("binary data content");
  });

  it("should handle large datasets", async () => {
    const content = "A".repeat(1024 * 1024);
    const largeData = new TextEncoder().encode(content);
    const fileName = "large.txt";

    const result = await zipBuffer(largeData, fileName);
    const zip = new AdmZip(result);

    expect(zip.readAsText(zip.getEntries()[0])).toBe(content);
  });
});
