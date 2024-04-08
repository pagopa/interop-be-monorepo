/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from "vitest";
import type { Db } from "mongodb";
import { buildEService } from "pagopa-interop-commons-test/dist/testUtils.js";
import {
  compareReadModelsCollection,
  zipEServices,
} from "../src/read-models-migration-check.js";

describe("read-models-migration-check", () => {
  const mockEService1 = buildEService();
  const mockEService2 = buildEService();
  const mockEService3 = buildEService();

  describe("zipIdentifiableData", () => {
    it("should zip two arrays of Identifiable objects", () => {
      const dataA = [mockEService1, mockEService2, mockEService3];
      const dataB = [mockEService3, mockEService2, mockEService1];

      const result = zipEServices(dataA, dataB);

      expect(result).toEqual([
        [mockEService1, mockEService1],
        [mockEService2, mockEService2],
        [mockEService3, mockEService3],
      ]);
    });

    it("should put undefined if one object with a specific id does not exist in one of the arrays", () => {
      const dataA = [mockEService1, mockEService2, mockEService3];
      const dataB = [mockEService3, mockEService2];

      const result = zipEServices(dataA, dataB);

      expect(result).toEqual([
        [mockEService1, undefined],
        [mockEService2, mockEService2],
        [mockEService3, mockEService3],
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

    it("should return an empty array if the data collections have no differences", async () => {
      const readModelA = MockMongoDb.mockDb([
        mockEService1,
        mockEService2,
        mockEService3,
      ]);
      const readModelB = MockMongoDb.mockDb([
        mockEService3,
        mockEService2,
        mockEService1,
      ]);

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([]);
    });

    it("should return an empty array if the data collections are empty", async () => {
      const readModelA = MockMongoDb.mockDb([]);
      const readModelB = MockMongoDb.mockDb([]);

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([]);
    });

    it("should return an array of differences if the data collections have differences", async () => {
      const differentMockEService3 = {
        ...mockEService3,
        name: "different name",
      };

      const readModelA = MockMongoDb.mockDb([
        mockEService1,
        mockEService2,
        mockEService3,
      ]);
      const readModelB = MockMongoDb.mockDb([
        differentMockEService3,
        mockEService2,
        mockEService1,
      ]);

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([[mockEService3, differentMockEService3]]);
    });

    it("should put undefined if an object with a given id does not exist in one of the readmodels", async () => {
      const readModelA = MockMongoDb.mockDb([
        mockEService1,
        mockEService2,
        mockEService3,
      ]);
      const readModelB = MockMongoDb.mockDb([mockEService3, mockEService2]);

      const result = await compareReadModelsCollection(
        readModelA,
        readModelB,
        "test"
      );

      expect(result).toEqual([[mockEService1, undefined]]);
    });
  });
});
