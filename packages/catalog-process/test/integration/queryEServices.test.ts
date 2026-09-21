import { catalogApi } from "pagopa-interop-api-clients";
import {
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  EServiceId,
  ListResult,
  Tenant,
  TenantId,
  descriptorState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addOneEService,
  addOneTenant,
  catalogService,
} from "../integrationUtils.js";

describe("query eservices", () => {
  const producerId: TenantId = generateId();

  const getPublishedDescriptor = (): Descriptor => ({
    ...getMockDescriptor(),
    state: descriptorState.published,
  });

  const buildEService = (
    name: string,
    createdAt: Date,
    id: EServiceId = generateId()
  ): EService => ({
    ...getMockEService(),
    id,
    name,
    createdAt,
    producerId,
    descriptors: [getPublishedDescriptor()],
  });

  const queryEServices = (
    sortBy: catalogApi.EServiceSortBy | undefined,
    offset = 0,
    limit = 50,
    keyword?: string
  ): Promise<ListResult<EService>> =>
    catalogService.queryEServices(
      { offset, limit, sortBy, keyword },
      getMockContext({})
    );

  const idsOf = (result: ListResult<EService>): EServiceId[] =>
    result.results.map((eservice) => eservice.id);

  describe("sortBy", () => {
    const eserviceApple = buildEService(
      "apple",
      new Date("2024-02-01T00:00:00Z")
    );
    const eserviceBanana = buildEService(
      "Banana",
      new Date("2024-03-01T00:00:00Z")
    );
    const eserviceCherry = buildEService(
      "cherry",
      new Date("2024-01-01T00:00:00Z")
    );

    beforeEach(async () => {
      await addOneEService(eserviceBanana);
      await addOneEService(eserviceApple);
      await addOneEService(eserviceCherry);
    });

    it("should sort the e-services from the most recent to the least recent when sortBy is not set", async () => {
      const result = await queryEServices(undefined);

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceBanana.id,
        eserviceApple.id,
        eserviceCherry.id,
      ]);
    });

    it("should sort the e-services by name in ascending order (sortBy: NAME_ASC)", async () => {
      const result = await queryEServices("NAME_ASC");

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceApple.id,
        eserviceBanana.id,
        eserviceCherry.id,
      ]);
    });

    it("should sort the e-services by name in descending order (sortBy: NAME_DESC)", async () => {
      const result = await queryEServices("NAME_DESC");

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceCherry.id,
        eserviceBanana.id,
        eserviceApple.id,
      ]);
    });

    it("should sort the e-services from the least recent to the most recent (sortBy: CREATED_AT_ASC)", async () => {
      const result = await queryEServices("CREATED_AT_ASC");

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceCherry.id,
        eserviceApple.id,
        eserviceBanana.id,
      ]);
    });

    it("should sort the e-services from the most recent to the least recent (sortBy: CREATED_AT_DESC)", async () => {
      const result = await queryEServices("CREATED_AT_DESC");

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceBanana.id,
        eserviceApple.id,
        eserviceCherry.id,
      ]);
    });

    it("should keep the sort order across pages", async () => {
      const pages = await Promise.all(
        [0, 1, 2].map((offset) => queryEServices("NAME_ASC", offset, 1))
      );

      expect(pages.map((page) => page.totalCount)).toEqual([3, 3, 3]);
      expect(pages.flatMap(idsOf)).toEqual([
        eserviceApple.id,
        eserviceBanana.id,
        eserviceCherry.id,
      ]);
    });
  });

  describe("deterministic pagination", () => {
    const sameCreatedAt = new Date("2024-01-01T00:00:00Z");
    const unorderedIds: EServiceId[] = [
      "00000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    ].map(unsafeBrandId<EServiceId>);
    const sortedIds = unorderedIds.toSorted();

    const equalEServices = unorderedIds.map((id) =>
      buildEService("Same name", sameCreatedAt, id)
    );

    beforeEach(async () => {
      for (const eservice of equalEServices) {
        await addOneEService(eservice);
      }
    });

    it.each<catalogApi.EServiceSortBy>([
      "NAME_ASC",
      "NAME_DESC",
      "CREATED_AT_ASC",
      "CREATED_AT_DESC",
    ])(
      "should paginate e-services with the same name and creation date in a deterministic order (sortBy: %s)",
      async (sortBy) => {
        const pages = await Promise.all(
          equalEServices.map((_, offset) => queryEServices(sortBy, offset, 1))
        );

        expect(pages.flatMap(idsOf)).toEqual(sortedIds);
      }
    );
  });

  describe("keyword", () => {
    const comuneDiMilano: Tenant = {
      ...getMockTenant(),
      name: "Comune di Milano",
    };
    const regioneLombardia: Tenant = {
      ...getMockTenant(),
      name: "Regione Lombardia",
    };

    const eserviceAnagrafe: EService = {
      ...buildEService("Anagrafe", new Date("2024-01-01T00:00:00Z")),
      description: "Consultazione dei dati anagrafici dei cittadini",
      producerId: comuneDiMilano.id,
    };
    const eserviceTributi: EService = {
      ...buildEService("Tributi", new Date("2024-02-01T00:00:00Z")),
      description: "Pagamento dei tributi comunali",
      producerId: comuneDiMilano.id,
    };
    const eserviceSanita: EService = {
      ...buildEService("Sanità", new Date("2024-03-01T00:00:00Z")),
      description: "Prenotazione delle visite specialistiche",
      producerId: regioneLombardia.id,
    };
    const eserviceMilanoServizi: EService = {
      ...buildEService("Milano Servizi", new Date("2024-04-01T00:00:00Z")),
      description: "Sportello digitale per le imprese",
      producerId: regioneLombardia.id,
    };
    const allEServicesMostRecentFirst = [
      eserviceMilanoServizi.id,
      eserviceSanita.id,
      eserviceTributi.id,
      eserviceAnagrafe.id,
    ];

    const search = (
      keyword: string | undefined,
      sortBy?: catalogApi.EServiceSortBy,
      offset = 0,
      limit = 50
    ): Promise<ListResult<EService>> =>
      queryEServices(sortBy, offset, limit, keyword);

    beforeEach(async () => {
      await addOneTenant(comuneDiMilano);
      await addOneTenant(regioneLombardia);
      await addOneEService(eserviceAnagrafe);
      await addOneEService(eserviceTributi);
      await addOneEService(eserviceSanita);
      await addOneEService(eserviceMilanoServizi);
    });

    it("should not filter the e-services when keyword is not set", async () => {
      const result = await search(undefined);

      expect(result.totalCount).toBe(4);
      expect(idsOf(result)).toEqual(allEServicesMostRecentFirst);
    });

    it.each(["", " ", "   "])(
      "should not filter the e-services when keyword contains only spaces (keyword: '%s')",
      async (keyword) => {
        const result = await search(keyword);

        expect(result.totalCount).toBe(4);
        expect(idsOf(result)).toEqual(allEServicesMostRecentFirst);
      }
    );

    it("should match the keyword on the e-service name", async () => {
      const result = await search("anagrafe");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceAnagrafe.id]);
    });

    it("should match the keyword on the e-service description", async () => {
      const result = await search("prenotazione");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceSanita.id]);
    });

    it("should match the keyword on the producer name", async () => {
      const result = await search("lombardia");

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceMilanoServizi.id,
        eserviceSanita.id,
      ]);
    });

    it("should match all the words of a multi-word keyword", async () => {
      const result = await search("dati anagrafici");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceAnagrafe.id]);
    });

    it.each(["sanità", "SANITÀ", "sanita", "Sanita"])(
      "should ignore case and accents (keyword: '%s')",
      async (keyword) => {
        const result = await search(keyword);

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eserviceSanita.id]);
      }
    );

    it("should match the keyword on the Italian stem of the words", async () => {
      const result = await search("tributo");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceTributi.id]);
    });

    it("should fall back to trigram similarity when the full text search has no result", async () => {
      const result = await search("anagrfe");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceAnagrafe.id]);
    });

    it("should return no e-service when nothing matches the keyword", async () => {
      const result = await search("xyzxyz");

      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });

    it("should order the e-services by relevance first: producer name matches before e-service name matches", async () => {
      const result = await search("milano");

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceTributi.id,
        eserviceAnagrafe.id,
        eserviceMilanoServizi.id,
      ]);
    });

    it.each<{
      sortBy: catalogApi.EServiceSortBy;
      expected: () => EServiceId[];
    }>([
      {
        sortBy: "CREATED_AT_DESC",
        expected: () => [
          eserviceTributi.id,
          eserviceAnagrafe.id,
          eserviceMilanoServizi.id,
        ],
      },
      {
        sortBy: "CREATED_AT_ASC",
        expected: () => [
          eserviceAnagrafe.id,
          eserviceTributi.id,
          eserviceMilanoServizi.id,
        ],
      },
      {
        sortBy: "NAME_ASC",
        expected: () => [
          eserviceAnagrafe.id,
          eserviceTributi.id,
          eserviceMilanoServizi.id,
        ],
      },
      {
        sortBy: "NAME_DESC",
        expected: () => [
          eserviceTributi.id,
          eserviceAnagrafe.id,
          eserviceMilanoServizi.id,
        ],
      },
    ])(
      "should apply sortBy as secondary criterion among e-services with the same relevance (sortBy: $sortBy)",
      async ({ sortBy, expected }) => {
        const result = await search("milano", sortBy);

        expect(idsOf(result)).toEqual(expected());
      }
    );

    it("should keep the relevance order across pages", async () => {
      const pages = await Promise.all(
        [0, 1, 2].map((offset) => search("milano", undefined, offset, 1))
      );

      expect(pages.map((page) => page.totalCount)).toEqual([3, 3, 3]);
      expect(pages.flatMap(idsOf)).toEqual([
        eserviceTributi.id,
        eserviceAnagrafe.id,
        eserviceMilanoServizi.id,
      ]);
    });

    it("should return an empty page with the total count when the offset exceeds the fuzzy results", async () => {
      const result = await search("anagrfe", undefined, 5, 1);

      expect(result.totalCount).toBe(1);
      expect(result.results).toEqual([]);
    });

    it.each(["!!!", "...", "- -"])(
      "should return no e-service when the keyword normalizes to an empty string (keyword: '%s')",
      async (keyword) => {
        const result = await search(keyword);

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      }
    );

    it.each(['"comune di milano"', "-comune di milano", "comune, di: milano!"])(
      "should ignore quotes, minus signs and punctuation (keyword: '%s')",
      async (keyword) => {
        const result = await search(keyword);

        expect(result.totalCount).toBe(2);
        expect(idsOf(result)).toEqual([
          eserviceTributi.id,
          eserviceAnagrafe.id,
        ]);
      }
    );

    it("should match an e-service whose producer has no tenant in the read model", async () => {
      const orphanEService: EService = {
        ...buildEService("Catasto", new Date("2024-05-01T00:00:00Z")),
        producerId: generateId(),
      };
      await addOneEService(orphanEService);

      const result = await search("catasto");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([orphanEService.id]);
    });

    it("should not return an e-service that matches the keyword but is not visible to the requester", async () => {
      const draftEService: EService = {
        ...buildEService("Protocollo", new Date("2024-05-01T00:00:00Z")),
        descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
        producerId: comuneDiMilano.id,
      };
      await addOneEService(draftEService);

      const fullTextResult = await search("protocollo");
      const fuzzyResult = await search("protocolo");

      expect(fullTextResult.totalCount).toBe(0);
      expect(fullTextResult.results).toEqual([]);
      expect(fuzzyResult.totalCount).toBe(0);
      expect(fuzzyResult.results).toEqual([]);
    });
  });
});
