import axios from "axios";
import { expect, vi, describe, it, MockedFunction } from "vitest";

import { getRegistryData } from "../src/services/openDataService.js";
import {
  agencyDataset,
  aooDataset,
  categoriesDataset,
  uoDataset,
} from "./dataset.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

vi.mock("axios");

const openDataConfig = {
  institutionsUrl: "https://example.test/institutions",
  aooUrl: "https://example.test/aoo",
  uoUrl: "https://example.test/uo",
  institutionsCategoriesUrl: "https://example.test/categories",
};

function mockOpenData(institutionsDataset: {
  fields: typeof agencyDataset.fields;
  records: readonly unknown[];
}): void {
  (axios.get as MockedFunction<typeof axios.get>).mockImplementation(
    async (url, _requestConfig) => {
      if (url === openDataConfig.institutionsUrl) {
        return { data: institutionsDataset };
      }

      if (url === openDataConfig.aooUrl) {
        return { data: aooDataset };
      }

      if (url === openDataConfig.uoUrl) {
        return { data: uoDataset };
      }

      if (url === openDataConfig.institutionsCategoriesUrl) {
        return { data: categoriesDataset };
      }

      return { data: {} };
    }
  );
}

describe("OpenDataService", async () => {
  it("getRegistryData return the correct combined data from the openData endpoint", async () => {
    mockOpenData(agencyDataset);

    const registryData = await getRegistryData(openDataConfig);

    expect(registryData).toEqual({
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    });
  });

  it("getRegistryData should discard institutions repeated in the openData", async () => {
    mockOpenData({
      ...agencyDataset,
      records: [agencyDataset.records[0], ...agencyDataset.records],
    });

    const registryData = await getRegistryData(openDataConfig);

    expect(registryData).toEqual({
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    });
  });
});
