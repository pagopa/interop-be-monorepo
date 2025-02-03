import axios from "axios";
import { expect, vi, describe, it, MockedFunction } from "vitest";
import { getRegistryData } from "../src/services/openDataService.js";
import { config } from "../src/config/config.js";
import {
  agencyDataset,
  aooDataset,
  categoriesDataset,
  uoDataset,
} from "./dataset.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

vi.mock("axios");

describe("OpenDataService", async () => {
  it("getRegistryData return the correct combined data from the openData endpoint", async () => {
    (axios.get as MockedFunction<typeof axios.get>).mockImplementation(
      async (url, _requestConfig) => {
        if (url === config.institutionsUrl) {
          return { data: agencyDataset };
        }

        if (url === config.aooUrl) {
          return { data: aooDataset };
        }

        if (url === config.uoUrl) {
          return { data: uoDataset };
        }

        if (url === config.institutionsCategoriesUrl) {
          return { data: categoriesDataset };
        }

        return { data: {} };
      }
    );

    const registryData = await getRegistryData();

    expect(registryData).toEqual({
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    });
  });
});
