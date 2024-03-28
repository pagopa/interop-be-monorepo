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
    const mockMongoDb = <T extends { id: string }>(data: T[]) =>
      ({
        collection: () => ({
          find: () => ({
            map: () => ({
              toArray: () => Promise.resolve(data),
            }),
          }),
        }),
      } as unknown as Db);

    it("should return an empty array if the data collections have no differences", async () => {
      const readModelA = mockMongoDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = mockMongoDb([
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
      const readModelA = mockMongoDb([]);
      const readModelB = mockMongoDb([]);

      const result = await getReadModelsCollectionDataDifferences(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([]);
    });

    it("should return an array of differences if the data collections have differences", async () => {
      const readModelA = mockMongoDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = mockMongoDb([
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
      const readModelA = mockMongoDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = mockMongoDb([
        { id: "3", name: "test 3" },
        { id: "2", name: "test 2" },
      ]);

      await expect(
        getReadModelsCollectionDataDifferences(readModelA, readModelB, "test")
      ).rejects.toThrowError();
    });

    it("should not throw an error if the first readModels misses one or more data from the second", async () => {
      const readModelA = mockMongoDb([{ id: "1", name: "test 1" }]);
      const readModelB = mockMongoDb([
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
