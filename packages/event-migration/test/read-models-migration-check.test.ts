/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { z } from "zod";
import {
  compareReadModelsCollection,
  zipDataById,
} from "../src/read-models-migration-check.js";

describe("read-models-migration-check", () => {
  describe("zipDataById", () => {
    it("should zip two arrays of Identifiable objects", () => {
      const dataA = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const dataB = [{ id: "3" }, { id: "2" }, { id: "1" }];

      const result = zipDataById(dataA, dataB);

      expect(result).toEqual([
        [{ id: "1" }, { id: "1" }],
        [{ id: "2" }, { id: "2" }],
        [{ id: "3" }, { id: "3" }],
      ]);
    });

    it("should put undefined if one object with a specific id does not exist in one of the arrays", () => {
      const dataA = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const dataB = [{ id: "3" }, { id: "2" }];

      const result = zipDataById(dataA, dataB);

      expect(result).toEqual([
        [{ id: "1" }, undefined],
        [{ id: "2" }, { id: "2" }],
        [{ id: "3" }, { id: "3" }],
      ]);
    });
  });

  describe("compareReadModelsCollection", () => {
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

    const TestSchema = z.object({
      id: z.string(),
      name: z.string(),
    });

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

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test",
        TestSchema
      );

      expect(result).toEqual([]);
    });

    it("should return an empty array if the data collections are empty", async () => {
      const readModelA = MockMongoDb.mockDb([]);
      const readModelB = MockMongoDb.mockDb([]);

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test",
        TestSchema
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

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test",
        TestSchema
      );

      expect(result).toEqual([
        [
          { id: "3", name: "test 3" },
          { id: "3", nsame: "difference" },
        ],
      ]);
    });

    it("should put undefined if an object with a given id does not exist in one of the readmodels", async () => {
      const readModelA = MockMongoDb.mockDb([
        { id: "1", name: "test 1" },
        { id: "2", name: "test 2" },
        { id: "3", name: "test 3" },
      ]);
      const readModelB = MockMongoDb.mockDb([
        { id: "3", name: "test 3" },
        { id: "2", name: "test 2" },
      ]);

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test",
        TestSchema
      );

      expect(result).toEqual([[{ id: "1", name: "test 1" }, undefined]]);
    });
  });
});
