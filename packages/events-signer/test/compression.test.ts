import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { compressJson } from "../src/utils/compression.js";

describe("compressJsonToZip", () => {
  it("should compress a simple JSON string successfully into a zip", async () => {
    const jsonString = JSON.stringify({ key: "value", num: 123 });
    const fileName = "data.json";
    const compressedBuffer = await compressJson(jsonString, fileName);

    expect(compressedBuffer).toBeInstanceOf(Buffer);

    const zip = new AdmZip(compressedBuffer);
    const zipEntries = zip.getEntries();

    expect(zipEntries.length).toBe(1);
    expect(zipEntries[0].entryName).toBe(fileName);

    const decompressedString = zip.readAsText(zipEntries[0]);
    expect(decompressedString).toEqual(jsonString);
  });

  it("should handle larger JSON strings", async () => {
    const largeObject = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
    }));
    const jsonString = JSON.stringify(largeObject);
    const compressedBuffer = await compressJson(jsonString, "large.json");

    const zip = new AdmZip(compressedBuffer);
    const decompressedString = zip.readAsText(zip.getEntries()[0]);

    expect(decompressedString).toEqual(jsonString);
  });
});
