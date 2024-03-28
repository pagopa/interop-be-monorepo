/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import {
  getReadModelsCollectionDataDifferences,
  zipIdentifiableData,
} from "../src/read-models-migration-check.js";

describe("read-models-migration-check", () => {
  describe("zipIdentifiableData", () => {
    it("should zip two arrays of Identifiable objects", () => {
      const dataA = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const dataB = [{ id: "3" }, { id: "2" }, { id: "1" }];

      const result = zipIdentifiableData(dataA, dataB);

      expect(result).toEqual([
        [{ id: "1" }, { id: "1" }],
        [{ id: "2" }, { id: "2" }],
        [{ id: "3" }, { id: "3" }],
      ]);
    });

    it("should throw an error if an Identifiable object is not found in the second array", () => {
      const dataA = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const dataB = [{ id: "3" }, { id: "2" }];

      expect(() => zipIdentifiableData(dataA, dataB)).toThrowError();
    });
  });

  describe("getReadModelsCollectionDataDifferences", () => {
    // A simple mock for the MongoDB client, no need to connect to a real database
    class MockMongoDb<T extends { id: string }> {
      private constructor(private data: T[]) {}

      public static mockDb<T extends { id: string }>(data: T[]) {
        return new MockMongoDb(data) as unknown as Db;
      }

      public collection() {
        return this;
      }

      public find() {
        return this;
      }

      public map() {
        return this;
      }

      public toArray() {
        return Promise.resolve(this.data);
      }
    }

    it("should return an empty array if the data collections have no differences", async () => {
      const readModelA = MockMongoDb.mockDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = MockMongoDb.mockDb([
        { id: "3", name: "test 3" },
        { id: "2", name: "test 2" },
        { id: "1", name: "test 1" },
      ]);

      const result = await getReadModelsCollectionDataDifferences(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([]);
    });

    it("should return an empty array if the data collections are empty", async () => {
      const readModelA = MockMongoDb.mockDb([]);
      const readModelB = MockMongoDb.mockDb([]);

      const result = await getReadModelsCollectionDataDifferences(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([]);
    });

    it("should return an array of differences if the data collections have differences", async () => {
      const readModelA = MockMongoDb.mockDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = MockMongoDb.mockDb([
        { id: "3", nsame: "difference" },
        { id: "2", name: "test 2" },
        { id: "1", name: "test 1" },
      ]);

      const result = await getReadModelsCollectionDataDifferences(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([
        [
          { id: "3", name: "test 3" },
          { id: "3", nsame: "difference" },
        ],
      ]);
    });

    it("should throw an error if one of the second data collection objects is missing", async () => {
      const readModelA = MockMongoDb.mockDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = MockMongoDb.mockDb([
        { id: "3", name: "test 3" },
        { id: "2", name: "test 2" },
      ]);

      await expect(
        getReadModelsCollectionDataDifferences(readModelA, readModelB, "test")
      ).rejects.toThrowError();
    });

    it("should not throw an error if the first readModels misses one or more data from the second", async () => {
      const readModelA = MockMongoDb.mockDb([{ id: "1", name: "test 1" }]);
      const readModelB = MockMongoDb.mockDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);

      await expect(
        getReadModelsCollectionDataDifferences(readModelA, readModelB, "test")
      ).resolves.not.toThrowError();
    });
  });
});
