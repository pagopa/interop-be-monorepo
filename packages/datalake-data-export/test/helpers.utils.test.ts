import { describe, expect, it, vi } from "vitest";
import {
  arrayToNdjson,
  getNdjsonBucketKey,
  splitArrayIntoChunks,
} from "../src/utils/helperUtils.js";

describe("helpers.utils", () => {
  describe("getNdjsonBucketKey", () => {
    it("should return the correct path", () => {
      vi.mock("crypto", () => ({
        randomUUID: vi.fn().mockReturnValue("1234"),
      }));

      const date = new Date("2021-01-01T00:00:00.000Z");
      const result = getNdjsonBucketKey("tenants", date);

      expect(result).toContain("20210101");
      expect(result).toContain("1234");
      expect(result).toContain("tenants");
    });
  });

  describe("splitArrayIntoChunks", () => {
    it("should return the correct chunks", () => {
      const array = [1, 2, 3, 4, 5];
      const result = splitArrayIntoChunks(array, 2);

      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("should return only one chunk if the array is smaller than the chunk size", () => {
      const array = [1, 2];
      const result = splitArrayIntoChunks(array, 3);

      expect(result).toEqual([[1, 2]]);
    });
  });

  describe("arrayToNdjson", () => {
    it("should return the correct ndjson string", () => {
      const array = [{ a: 1 }, { b: 2 }];
      const result = arrayToNdjson(array);

      expect(result).toEqual('{"a":1}\n{"b":2}\n');
    });
  });
});
