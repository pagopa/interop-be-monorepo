import { gzip } from "zlib";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("zlib", () => ({
  gzip: vi.fn(),
}));

import { gzipBuffer } from "../../../src/utils/compression.js";

describe("gzipBuffer", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should gzip a buffer and return a Buffer", async () => {
    const input = Buffer.from("hello world");
    const expectedCompressed = Buffer.from([0x1f, 0x8b, 0x08]);

    (gzip as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_data, cb) => cb(null, expectedCompressed)
    );

    const result = await gzipBuffer(input);

    expect(gzip).toHaveBeenCalledOnce();
    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(expectedCompressed);
  });

  it("should throw if gzip encounters an error", async () => {
    const input = Buffer.from("test");
    const fakeError = new Error("gzip failed");

    (gzip as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_data, cb) => cb(fakeError)
    );

    await expect(gzipBuffer(input)).rejects.toThrow("gzip failed");
  });
});
