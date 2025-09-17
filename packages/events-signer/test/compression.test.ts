import { gunzipSync } from "zlib";
import { describe, expect, it } from "vitest";
import { compressJson } from "../src/utils/compression.js";

describe("compressJson", () => {
  it("should compress a simple JSON string successfully", async () => {
    const jsonString = JSON.stringify({ key: "value", num: 123 });
    const compressedBuffer = await compressJson(jsonString);

    expect(compressedBuffer).toBeInstanceOf(Buffer);
    expect(compressedBuffer.length).toBeGreaterThan(0);

    const decompressedString = gunzipSync(compressedBuffer).toString("utf8");
    expect(decompressedString).toEqual(jsonString);
  });

  it("should return a compressed empty object string", async () => {
    const jsonString = JSON.stringify({});
    const compressedBuffer = await compressJson(jsonString);

    expect(compressedBuffer).toBeInstanceOf(Buffer);
    expect(compressedBuffer.length).toBeGreaterThan(0);

    const decompressedString = gunzipSync(compressedBuffer).toString("utf8");
    expect(decompressedString).toEqual(jsonString);
  });

  it("should handle larger JSON strings", async () => {
    const largeObject = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      description: `Description for item ${i}`,
    }));
    const jsonString = JSON.stringify(largeObject);
    const compressedBuffer = await compressJson(jsonString);

    expect(compressedBuffer).toBeInstanceOf(Buffer);

    const decompressedString = gunzipSync(compressedBuffer).toString("utf8");
    expect(decompressedString).toEqual(jsonString);
  });
});
