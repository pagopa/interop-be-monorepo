/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { describe, expect, it } from "vitest";

describe("Integration tests", async () => {
  describe("Events V1", () => {
    it(() => {
      expect(1).toBe(1);
    });
  });
  describe("Events V2", () => {
    it(() => {
      expect(2).toBe(2);
    });
  });
});
