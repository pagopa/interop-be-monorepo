import { catalogApi } from "pagopa-interop-api-clients";
import {
  getMockAgreement,
  getMockAttribute,
  getMockAuthData,
  getMockCertifiedDiscreteTenantAttribute,
  getMockCertifiedTenantAttribute,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  CertifiedTenantAttribute,
  AttributeCertifiedDiscreteComparator,
  AttributeId,
  Descriptor,
  EService,
  EServiceId,
  EServiceTemplateId,
  ListResult,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  PurposeTemplate,
  Tenant,
  TenantId,
  agreementState,
  attributeCertifiedDiscreteComparator,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  purposeTemplateState,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
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

  const filterEServices = (
    filters: Omit<
      Partial<catalogApi.EServicesFilterPayload>,
      "offset" | "limit"
    >,
    context: ReturnType<typeof getMockContext> = getMockContext({}),
    offset = 0,
    limit = 50
  ): Promise<ListResult<EService>> =>
    catalogService.queryEServices({ offset, limit, ...filters }, context);

  describe("mode", () => {
    const eservice0: EService = {
      ...buildEService("Service 0", new Date("2024-01-01T00:00:00Z")),
      mode: "Deliver",
    };
    const eservice1: EService = {
      ...buildEService("Service 1", new Date("2024-02-01T00:00:00Z")),
      mode: "Receive",
    };

    beforeEach(async () => {
      await addOneEService(eservice0);
      await addOneEService(eservice1);
    });

    it("should return the expected e-services when mode is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([eservice1.id, eservice0.id]);
    });

    it("should return the expected e-services when mode is DELIVER", async () => {
      const result = await filterEServices({ mode: "DELIVER" });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eservice0.id]);
    });

    it("should return the expected e-services when mode is RECEIVE", async () => {
      const result = await filterEServices({ mode: "RECEIVE" });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eservice1.id]);
    });

    it("should preserve filtered counts and ordering across pages", async () => {
      const additional: EService = {
        ...eservice0,
        descriptors: [getPublishedDescriptor()],
        id: generateId(),
        name: "Additional",
        createdAt: new Date("2024-04-01T00:00:00Z"),
      };
      await addOneEService(additional);
      const pages = await Promise.all(
        [0, 1, 2].map((offset) =>
          filterEServices({ mode: "DELIVER" }, getMockContext({}), offset, 1)
        )
      );

      expect(pages.map((page) => page.totalCount)).toEqual([2, 2, 2]);
      expect(pages.map(idsOf)).toEqual([[additional.id], [eservice0.id], []]);
    });
  });

  describe("onlySignalHubEnabled", () => {
    const eservice0: EService = {
      ...buildEService("Service 0", new Date("2024-01-01T00:00:00Z")),
      isSignalHubEnabled: true,
    };
    const eservice1: EService = {
      ...buildEService("Service 1", new Date("2024-02-01T00:00:00Z")),
      isSignalHubEnabled: false,
    };
    const eservice2: EService = {
      ...buildEService("Service 2", new Date("2024-03-01T00:00:00Z")),
      isSignalHubEnabled: undefined,
    };

    beforeEach(async () => {
      await addOneEService(eservice0);
      await addOneEService(eservice1);
      await addOneEService(eservice2);
    });

    it("should return the expected e-services when onlySignalHubEnabled is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([eservice2.id, eservice1.id, eservice0.id]);
    });

    it("should return the expected e-services when onlySignalHubEnabled is true", async () => {
      const result = await filterEServices({ onlySignalHubEnabled: true });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eservice0.id]);
    });

    it("should return the expected e-services when onlySignalHubEnabled is false", async () => {
      const result = await filterEServices({ onlySignalHubEnabled: false });

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([eservice2.id, eservice1.id]);
    });

    it("should preserve filtered counts and ordering across pages", async () => {
      const additional: EService = {
        ...eservice0,
        descriptors: [getPublishedDescriptor()],
        id: generateId(),
        name: "Additional",
        createdAt: new Date("2024-04-01T00:00:00Z"),
      };
      await addOneEService(additional);
      const pages = await Promise.all(
        [0, 1, 2].map((offset) =>
          filterEServices(
            { onlySignalHubEnabled: true },
            getMockContext({}),
            offset,
            1
          )
        )
      );

      expect(pages.map((page) => page.totalCount)).toEqual([2, 2, 2]);
      expect(pages.map(idsOf)).toEqual([[additional.id], [eservice0.id], []]);
    });
  });

  describe("asyncExchange", () => {
    const eservice0: EService = {
      ...buildEService("Service 0", new Date("2024-01-01T00:00:00Z")),
      asyncExchange: true,
    };
    const eservice1: EService = {
      ...buildEService("Service 1", new Date("2024-02-01T00:00:00Z")),
      asyncExchange: false,
    };
    const eservice2: EService = {
      ...buildEService("Service 2", new Date("2024-03-01T00:00:00Z")),
      asyncExchange: undefined,
    };

    beforeEach(async () => {
      await addOneEService(eservice0);
      await addOneEService(eservice1);
      await addOneEService(eservice2);
    });

    it("should return the expected e-services when asyncExchange is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([eservice2.id, eservice1.id, eservice0.id]);
    });

    it("should return the expected e-services when asyncExchange is true", async () => {
      const result = await filterEServices({ asyncExchange: true });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eservice0.id]);
    });

    it("should return the expected e-services when asyncExchange is false", async () => {
      const result = await filterEServices({ asyncExchange: false });

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([eservice2.id, eservice1.id]);
    });

    it("should preserve filtered counts and ordering across pages", async () => {
      const additional: EService = {
        ...eservice0,
        descriptors: [getPublishedDescriptor()],
        id: generateId(),
        name: "Additional",
        createdAt: new Date("2024-04-01T00:00:00Z"),
      };
      await addOneEService(additional);
      const pages = await Promise.all(
        [0, 1, 2].map((offset) =>
          filterEServices(
            { asyncExchange: true },
            getMockContext({}),
            offset,
            1
          )
        )
      );

      expect(pages.map((page) => page.totalCount)).toEqual([2, 2, 2]);
      expect(pages.map(idsOf)).toEqual([[additional.id], [eservice0.id], []]);
    });
  });

  describe("combined mode, Signal Hub and async exchange filters", () => {
    it("should require all three filters to match", async () => {
      const matching: EService = {
        ...buildEService("Matching", new Date("2024-01-01T00:00:00Z")),
        mode: "Deliver",
        isSignalHubEnabled: true,
        asyncExchange: true,
      };
      const otherMode: EService = {
        ...matching,
        descriptors: [getPublishedDescriptor()],
        id: generateId(),
        mode: "Receive",
      };
      const withoutSignalHub: EService = {
        ...matching,
        descriptors: [getPublishedDescriptor()],
        id: generateId(),
        isSignalHubEnabled: false,
      };
      const synchronous: EService = {
        ...matching,
        descriptors: [getPublishedDescriptor()],
        id: generateId(),
        asyncExchange: false,
      };
      await addOneEService(matching);
      await addOneEService(otherMode);
      await addOneEService(withoutSignalHub);
      await addOneEService(synchronous);

      const result = await filterEServices({
        mode: "DELIVER",
        onlySignalHubEnabled: true,
        asyncExchange: true,
      });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([matching.id]);
    });
  });

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

    it.each(catalogApi.EServiceSortBy.options)(
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

    it("should fall back to trigram similarity when the only full text match is not visible to the requester", async () => {
      const draftEService: EService = {
        ...buildEService("Anagrfe", new Date("2024-05-01T00:00:00Z")),
        descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
        producerId: comuneDiMilano.id,
      };
      await addOneEService(draftEService);

      const result = await search("anagrfe");

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceAnagrafe.id]);
    });

    it("should fall back to trigram similarity when the only full text match is excluded by the filters", async () => {
      const otherProducerEService: EService = {
        ...buildEService("Anagrfe", new Date("2024-05-01T00:00:00Z")),
        producerId: regioneLombardia.id,
      };
      await addOneEService(otherProducerEService);

      const result = await filterEServices({
        keyword: "anagrfe",
        producersIds: [comuneDiMilano.id],
      });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceAnagrafe.id]);
    });
  });

  describe("producersIds", () => {
    const producerAlpha: TenantId = generateId();
    const producerBeta: TenantId = generateId();
    const producerGamma: TenantId = generateId();

    const eserviceAlpha: EService = {
      ...buildEService("Alpha", new Date("2024-01-01T00:00:00Z")),
      producerId: producerAlpha,
    };
    const eserviceBeta: EService = {
      ...buildEService("Beta", new Date("2024-02-01T00:00:00Z")),
      producerId: producerBeta,
    };
    const eserviceGamma: EService = {
      ...buildEService("Gamma", new Date("2024-03-01T00:00:00Z")),
      producerId: producerGamma,
    };

    beforeEach(async () => {
      await addOneEService(eserviceAlpha);
      await addOneEService(eserviceBeta);
      await addOneEService(eserviceGamma);
    });

    it("should not filter the e-services when producersIds is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceGamma.id,
        eserviceBeta.id,
        eserviceAlpha.id,
      ]);
    });

    it("should not filter the e-services when producersIds is empty", async () => {
      const result = await filterEServices({ producersIds: [] });

      expect(result.totalCount).toBe(3);
    });

    it("should return only the e-services of the given producer", async () => {
      const result = await filterEServices({ producersIds: [producerAlpha] });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceAlpha.id]);
    });

    it("should return the e-services of any of the given producers", async () => {
      const result = await filterEServices({
        producersIds: [producerAlpha, producerBeta],
      });

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([eserviceBeta.id, eserviceAlpha.id]);
    });

    it("should include an e-service whose active producer delegate is among the given producers", async () => {
      const delegateId: TenantId = generateId();
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          state: delegationState.active,
          eserviceId: eserviceGamma.id,
          delegateId,
        })
      );

      const result = await filterEServices({ producersIds: [delegateId] });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceGamma.id]);
    });

    it("should ignore delegations that are not active producer delegations", async () => {
      const pendingDelegateId: TenantId = generateId();
      const consumerDelegateId: TenantId = generateId();
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          state: delegationState.waitingForApproval,
          eserviceId: eserviceAlpha.id,
          delegateId: pendingDelegateId,
        })
      );
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          state: delegationState.active,
          eserviceId: eserviceBeta.id,
          delegateId: consumerDelegateId,
        })
      );

      const result = await filterEServices({
        producersIds: [pendingDelegateId, consumerDelegateId],
      });

      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe("onlyActiveEservices", () => {
    const eserviceActive: EService = {
      ...buildEService("Active", new Date("2024-01-01T00:00:00Z")),
      descriptors: [
        { ...getMockDescriptor(descriptorState.published), version: "1" },
      ],
    };
    const eserviceSuspended: EService = {
      ...buildEService("Suspended", new Date("2024-02-01T00:00:00Z")),
      descriptors: [
        { ...getMockDescriptor(descriptorState.suspended), version: "1" },
      ],
    };
    // The relevant descriptor is the latest published one; an older, previously
    // deprecated descriptor has been suspended.
    const eserviceRepublished: EService = {
      ...buildEService("Republished", new Date("2024-03-01T00:00:00Z")),
      descriptors: [
        { ...getMockDescriptor(descriptorState.suspended), version: "1" },
        { ...getMockDescriptor(descriptorState.published), version: "2" },
      ],
    };

    beforeEach(async () => {
      await addOneEService(eserviceActive);
      await addOneEService(eserviceSuspended);
      await addOneEService(eserviceRepublished);
    });

    it("should not filter the e-services when onlyActiveEservices is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(3);
    });

    it("should exclude the e-services whose relevant descriptor is suspended (onlyActiveEservices: true)", async () => {
      const result = await filterEServices({ onlyActiveEservices: true });

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceRepublished.id,
        eserviceActive.id,
      ]);
    });

    it("should keep an e-service whose suspended descriptor is not the relevant one (onlyActiveEservices: true)", async () => {
      const result = await filterEServices({ onlyActiveEservices: true });

      expect(idsOf(result)).toContain(eserviceRepublished.id);
      expect(idsOf(result)).not.toContain(eserviceSuspended.id);
    });

    it("should exclude an e-service whose suspended descriptor is followed only by an archived one (onlyActiveEservices: true)", async () => {
      const eserviceNewerArchived: EService = {
        ...buildEService("Newer archived", new Date("2024-04-01T00:00:00Z")),
        descriptors: [
          { ...getMockDescriptor(descriptorState.suspended), version: "1" },
          { ...getMockDescriptor(descriptorState.archived), version: "2" },
        ],
      };
      await addOneEService(eserviceNewerArchived);

      const result = await filterEServices({ onlyActiveEservices: true });

      expect(idsOf(result)).not.toContain(eserviceNewerArchived.id);
    });
  });

  describe("subscribedByRequester", () => {
    const requesterId: TenantId = generateId();
    const requesterContext = getMockContext({
      authData: getMockAuthData(requesterId),
    });

    const eserviceActiveAgreement = buildEService(
      "ActiveAgreement",
      new Date("2024-01-01T00:00:00Z")
    );
    const eserviceSuspendedAgreement = buildEService(
      "SuspendedAgreement",
      new Date("2024-02-01T00:00:00Z")
    );
    const eserviceDraftAgreement = buildEService(
      "DraftAgreement",
      new Date("2024-03-01T00:00:00Z")
    );
    const eserviceNoAgreement = buildEService(
      "NoAgreement",
      new Date("2024-04-01T00:00:00Z")
    );

    beforeEach(async () => {
      await addOneEService(eserviceActiveAgreement);
      await addOneEService(eserviceSuspendedAgreement);
      await addOneEService(eserviceDraftAgreement);
      await addOneEService(eserviceNoAgreement);
      await addOneAgreement(
        getMockAgreement(
          eserviceActiveAgreement.id,
          requesterId,
          agreementState.active
        )
      );
      await addOneAgreement(
        getMockAgreement(
          eserviceSuspendedAgreement.id,
          requesterId,
          agreementState.suspended
        )
      );
      await addOneAgreement(
        getMockAgreement(
          eserviceDraftAgreement.id,
          requesterId,
          agreementState.draft
        )
      );
      // An active agreement of another consumer must not count for the requester.
      await addOneAgreement(
        getMockAgreement(
          eserviceNoAgreement.id,
          generateId<TenantId>(),
          agreementState.active
        )
      );
    });

    it("should not filter the e-services when subscribedByRequester is not set", async () => {
      const result = await filterEServices({}, requesterContext);

      expect(result.totalCount).toBe(4);
    });

    it("should return only the e-services with a valid agreement of the requester (subscribedByRequester: true)", async () => {
      const result = await filterEServices(
        { subscribedByRequester: true },
        requesterContext
      );

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceSuspendedAgreement.id,
        eserviceActiveAgreement.id,
      ]);
    });

    it("should return only the e-services without a valid agreement of the requester (subscribedByRequester: false)", async () => {
      const result = await filterEServices(
        { subscribedByRequester: false },
        requesterContext
      );

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceNoAgreement.id,
        eserviceDraftAgreement.id,
      ]);
    });
  });

  describe("requesterDelegationRoles", () => {
    const requesterId: TenantId = generateId();
    const requesterContext = getMockContext({
      authData: getMockAuthData(requesterId),
    });

    const eserviceReceived = buildEService(
      "Received",
      new Date("2024-01-01T00:00:00Z")
    );
    const eserviceEntrusted = buildEService(
      "Entrusted",
      new Date("2024-02-01T00:00:00Z")
    );
    const eserviceUnrelated = buildEService(
      "Unrelated",
      new Date("2024-03-01T00:00:00Z")
    );

    beforeEach(async () => {
      await addOneEService(eserviceReceived);
      await addOneEService(eserviceEntrusted);
      await addOneEService(eserviceUnrelated);
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          state: delegationState.active,
          eserviceId: eserviceReceived.id,
          delegateId: requesterId,
        })
      );
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          state: delegationState.active,
          eserviceId: eserviceEntrusted.id,
          delegatorId: requesterId,
        })
      );
    });

    it("should not filter the e-services when requesterDelegationRoles is not set", async () => {
      const result = await filterEServices({}, requesterContext);

      expect(result.totalCount).toBe(3);
    });

    it("should not filter the e-services when requesterDelegationRoles is empty", async () => {
      const result = await filterEServices(
        { requesterDelegationRoles: [] },
        requesterContext
      );

      expect(result.totalCount).toBe(3);
    });

    it("should return the e-services received in delegation (requesterDelegationRoles: DELEGATE)", async () => {
      const result = await filterEServices(
        { requesterDelegationRoles: ["DELEGATE"] },
        requesterContext
      );

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceReceived.id]);
    });

    it("should return the e-services entrusted in delegation (requesterDelegationRoles: DELEGATOR)", async () => {
      const result = await filterEServices(
        { requesterDelegationRoles: ["DELEGATOR"] },
        requesterContext
      );

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceEntrusted.id]);
    });

    it("should return the e-services where the requester is delegate or delegator (requesterDelegationRoles: DELEGATE and DELEGATOR)", async () => {
      const result = await filterEServices(
        { requesterDelegationRoles: ["DELEGATE", "DELEGATOR"] },
        requesterContext
      );

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceEntrusted.id,
        eserviceReceived.id,
      ]);
    });

    it("should ignore delegations that are not active producer delegations", async () => {
      const eservicePendingDelegation = buildEService(
        "PendingDelegation",
        new Date("2024-04-01T00:00:00Z")
      );
      const eserviceConsumerDelegation = buildEService(
        "ConsumerDelegation",
        new Date("2024-05-01T00:00:00Z")
      );
      await addOneEService(eservicePendingDelegation);
      await addOneEService(eserviceConsumerDelegation);
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          state: delegationState.waitingForApproval,
          eserviceId: eservicePendingDelegation.id,
          delegateId: requesterId,
        })
      );
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          state: delegationState.active,
          eserviceId: eserviceConsumerDelegation.id,
          delegateId: requesterId,
        })
      );

      const result = await filterEServices(
        { requesterDelegationRoles: ["DELEGATE"] },
        requesterContext
      );

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceReceived.id]);
    });
  });

  describe("onlyTemplateInstances", () => {
    const eserviceInstanceA: EService = {
      ...buildEService("InstanceA", new Date("2024-01-01T00:00:00Z")),
      templateId: generateId<EServiceTemplateId>(),
    };
    const eserviceInstanceB: EService = {
      ...buildEService("InstanceB", new Date("2024-02-01T00:00:00Z")),
      templateId: generateId<EServiceTemplateId>(),
    };
    const eserviceNoTemplate = buildEService(
      "NoTemplate",
      new Date("2024-03-01T00:00:00Z")
    );

    beforeEach(async () => {
      await addOneEService(eserviceInstanceA);
      await addOneEService(eserviceInstanceB);
      await addOneEService(eserviceNoTemplate);
    });

    it("should not filter the e-services when onlyTemplateInstances is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(3);
    });

    it("should not filter the e-services when onlyTemplateInstances is false", async () => {
      const result = await filterEServices({ onlyTemplateInstances: false });

      expect(result.totalCount).toBe(3);
    });

    it("should return only the e-services with a template (onlyTemplateInstances: true)", async () => {
      const result = await filterEServices({ onlyTemplateInstances: true });

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceInstanceB.id,
        eserviceInstanceA.id,
      ]);
    });
  });

  describe("hasLinkedPurposeTemplates", () => {
    const publishedPurposeTemplate = (): PurposeTemplate =>
      getMockPurposeTemplate(undefined, purposeTemplateState.published);
    const purposeTemplateA = publishedPurposeTemplate();
    const purposeTemplateB = publishedPurposeTemplate();
    const purposeTemplateDraft = getMockPurposeTemplate(
      undefined,
      purposeTemplateState.draft
    );
    const purposeTemplateArchived = getMockPurposeTemplate(
      undefined,
      purposeTemplateState.archived
    );

    const eserviceLinked = buildEService(
      "Linked",
      new Date("2024-01-01T00:00:00Z")
    );
    const eserviceLinkedToOldDescriptor = buildEService(
      "LinkedToOldDescriptor",
      new Date("2024-02-01T00:00:00Z")
    );
    const eserviceLinkedTwice = buildEService(
      "LinkedTwice",
      new Date("2024-03-01T00:00:00Z")
    );
    const eserviceNotLinked = buildEService(
      "NotLinked",
      new Date("2024-04-01T00:00:00Z")
    );
    const eserviceLinkedToDraft = buildEService(
      "LinkedToDraft",
      new Date("2024-05-01T00:00:00Z")
    );
    const eserviceLinkedToArchived = buildEService(
      "LinkedToArchived",
      new Date("2024-06-01T00:00:00Z")
    );

    beforeEach(async () => {
      await addOnePurposeTemplate(purposeTemplateA);
      await addOnePurposeTemplate(purposeTemplateB);
      await addOnePurposeTemplate(purposeTemplateDraft);
      await addOnePurposeTemplate(purposeTemplateArchived);
      await addOneEService(eserviceLinked);
      await addOneEService(eserviceLinkedToOldDescriptor);
      await addOneEService(eserviceLinkedTwice);
      await addOneEService(eserviceNotLinked);
      await addOneEService(eserviceLinkedToDraft);
      await addOneEService(eserviceLinkedToArchived);
      await addOnePurposeTemplateEServiceDescriptor({
        purposeTemplateId: purposeTemplateDraft.id,
        eserviceId: eserviceLinkedToDraft.id,
        descriptorId: eserviceLinkedToDraft.descriptors[0].id,
        createdAt: new Date(),
      });
      await addOnePurposeTemplateEServiceDescriptor({
        purposeTemplateId: purposeTemplateArchived.id,
        eserviceId: eserviceLinkedToArchived.id,
        descriptorId: eserviceLinkedToArchived.descriptors[0].id,
        createdAt: new Date(),
      });
      await addOnePurposeTemplateEServiceDescriptor({
        purposeTemplateId: purposeTemplateA.id,
        eserviceId: eserviceLinked.id,
        descriptorId: eserviceLinked.descriptors[0].id,
        createdAt: new Date(),
      });
      // The descriptor of this link no longer exists: the link still counts.
      await addOnePurposeTemplateEServiceDescriptor({
        purposeTemplateId: purposeTemplateA.id,
        eserviceId: eserviceLinkedToOldDescriptor.id,
        descriptorId: generateId(),
        createdAt: new Date(),
      });
      await addOnePurposeTemplateEServiceDescriptor({
        purposeTemplateId: purposeTemplateA.id,
        eserviceId: eserviceLinkedTwice.id,
        descriptorId: eserviceLinkedTwice.descriptors[0].id,
        createdAt: new Date(),
      });
      await addOnePurposeTemplateEServiceDescriptor({
        purposeTemplateId: purposeTemplateB.id,
        eserviceId: eserviceLinkedTwice.id,
        descriptorId: eserviceLinkedTwice.descriptors[0].id,
        createdAt: new Date(),
      });
    });

    it("should not filter the e-services when hasLinkedPurposeTemplates is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(6);
    });

    it("should not filter the e-services when hasLinkedPurposeTemplates is false", async () => {
      const result = await filterEServices({
        hasLinkedPurposeTemplates: false,
      });

      expect(result.totalCount).toBe(6);
    });

    it("should return only the e-services with at least one linked published purpose template, once each (hasLinkedPurposeTemplates: true)", async () => {
      const result = await filterEServices({ hasLinkedPurposeTemplates: true });

      expect(result.totalCount).toBe(3);
      expect(idsOf(result)).toEqual([
        eserviceLinkedTwice.id,
        eserviceLinkedToOldDescriptor.id,
        eserviceLinked.id,
      ]);
    });

    it("should not count the links to draft or archived purpose templates", async () => {
      const result = await filterEServices({ hasLinkedPurposeTemplates: true });

      expect(idsOf(result)).not.toContain(eserviceLinkedToDraft.id);
      expect(idsOf(result)).not.toContain(eserviceLinkedToArchived.id);
    });
  });

  describe("producerCategories", () => {
    const ipaAttribute = (code: string): Attribute => ({
      ...getMockAttribute(),
      code,
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    });
    const attributeComune = ipaAttribute("L6");
    const attributeComunita = ipaAttribute("L18");
    const attributeRegione = ipaAttribute("L4");
    const attributePaCentrale = ipaAttribute("C1");
    // Same code as attributeComune, created by a certifier: not an IPA category.
    const attributeCertifierL6: Attribute = {
      ...getMockAttribute(),
      code: "L6",
      origin: generateId(),
    };

    const certifiedAttribute = (
      attribute: Attribute,
      revocationTimestamp?: Date
    ): CertifiedTenantAttribute => ({
      ...getMockCertifiedTenantAttribute(attribute.id),
      revocationTimestamp,
    });

    const comune: Tenant = {
      ...getMockTenant(),
      attributes: [certifiedAttribute(attributeComune)],
    };
    const regione: Tenant = {
      ...getMockTenant(),
      attributes: [certifiedAttribute(attributeRegione)],
    };
    const paCentrale: Tenant = {
      ...getMockTenant(),
      attributes: [certifiedAttribute(attributePaCentrale)],
    };
    const comuneTwoCodes: Tenant = {
      ...getMockTenant(),
      attributes: [
        certifiedAttribute(attributeComune),
        certifiedAttribute(attributeComunita),
      ],
    };
    const exComuneNowPaCentrale: Tenant = {
      ...getMockTenant(),
      attributes: [
        certifiedAttribute(attributeComune, new Date("2024-01-01T00:00:00Z")),
        certifiedAttribute(attributePaCentrale),
      ],
    };
    const certifiedByCertifier: Tenant = {
      ...getMockTenant(),
      attributes: [certifiedAttribute(attributeCertifierL6)],
    };
    const noCategory: Tenant = getMockTenant();

    const eserviceComune: EService = {
      ...buildEService("Comune", new Date("2024-01-01T00:00:00Z")),
      producerId: comune.id,
    };
    const eserviceRegione: EService = {
      ...buildEService("Regione", new Date("2024-02-01T00:00:00Z")),
      producerId: regione.id,
    };
    const eservicePaCentrale: EService = {
      ...buildEService("PaCentrale", new Date("2024-03-01T00:00:00Z")),
      producerId: paCentrale.id,
    };
    const eserviceComuneTwoCodes: EService = {
      ...buildEService("ComuneTwoCodes", new Date("2024-04-01T00:00:00Z")),
      producerId: comuneTwoCodes.id,
    };
    const eserviceExComune: EService = {
      ...buildEService("ExComune", new Date("2024-05-01T00:00:00Z")),
      producerId: exComuneNowPaCentrale.id,
    };
    const eserviceCertifiedByCertifier: EService = {
      ...buildEService(
        "CertifiedByCertifier",
        new Date("2024-06-01T00:00:00Z")
      ),
      producerId: certifiedByCertifier.id,
    };
    const eserviceNoCategory: EService = {
      ...buildEService("NoCategory", new Date("2024-07-01T00:00:00Z")),
      producerId: noCategory.id,
    };

    beforeEach(async () => {
      await addOneAttribute(attributeComune);
      await addOneAttribute(attributeComunita);
      await addOneAttribute(attributeRegione);
      await addOneAttribute(attributePaCentrale);
      await addOneAttribute(attributeCertifierL6);
      await addOneTenant(comune);
      await addOneTenant(regione);
      await addOneTenant(paCentrale);
      await addOneTenant(comuneTwoCodes);
      await addOneTenant(exComuneNowPaCentrale);
      await addOneTenant(certifiedByCertifier);
      await addOneTenant(noCategory);
      await addOneEService(eserviceComune);
      await addOneEService(eserviceRegione);
      await addOneEService(eservicePaCentrale);
      await addOneEService(eserviceComuneTwoCodes);
      await addOneEService(eserviceExComune);
      await addOneEService(eserviceCertifiedByCertifier);
      await addOneEService(eserviceNoCategory);
    });

    it("should not filter the e-services when producerCategories is not set", async () => {
      const result = await filterEServices({});

      expect(result.totalCount).toBe(7);
    });

    it("should not filter the e-services when producerCategories is empty", async () => {
      const result = await filterEServices({ producerCategories: [] });

      expect(result.totalCount).toBe(7);
    });

    it("should return only the e-services of producers with an IPA certified attribute of the category (producerCategories: COMUNI)", async () => {
      const result = await filterEServices({ producerCategories: ["COMUNI"] });

      expect(result.totalCount).toBe(2);
      expect(idsOf(result)).toEqual([
        eserviceComuneTwoCodes.id,
        eserviceComune.id,
      ]);
    });

    it("should not match a certifier attribute that has the code of an IPA category", async () => {
      const result = await filterEServices({ producerCategories: ["COMUNI"] });

      expect(idsOf(result)).not.toContain(eserviceCertifiedByCertifier.id);
    });

    it("should ignore a revoked certified attribute and keep the valid ones of the same producer", async () => {
      const comuni = await filterEServices({ producerCategories: ["COMUNI"] });
      const paCentrali = await filterEServices({
        producerCategories: ["PUBBLICHE_AMMINISTRAZIONI_CENTRALI"],
      });

      expect(idsOf(comuni)).not.toContain(eserviceExComune.id);
      expect(idsOf(paCentrali)).toEqual([
        eserviceExComune.id,
        eservicePaCentrale.id,
      ]);
    });

    it.each<catalogApi.EServiceProducerCategory>([
      "REGIONI_PROVINCE_AUTONOME",
      "CONSORZI_ASSOCIAZIONI_REGIONALI",
    ])(
      "should return the same producer for both categories that share the code L4 (producerCategories: %s)",
      async (category) => {
        const result = await filterEServices({
          producerCategories: [category],
        });

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eserviceRegione.id]);
      }
    );

    it("should return the e-services of producers in at least one of the categories (producerCategories: COMUNI and PUBBLICHE_AMMINISTRAZIONI_CENTRALI)", async () => {
      const result = await filterEServices({
        producerCategories: ["COMUNI", "PUBBLICHE_AMMINISTRAZIONI_CENTRALI"],
      });

      expect(result.totalCount).toBe(4);
      expect(idsOf(result)).toEqual([
        eserviceExComune.id,
        eserviceComuneTwoCodes.id,
        eservicePaCentrale.id,
        eserviceComune.id,
      ]);
    });

    it("should keep the count consistent across pages (producerCategories: COMUNI)", async () => {
      const pages = await Promise.all(
        [0, 1].map((offset) =>
          filterEServices(
            { producerCategories: ["COMUNI"] },
            getMockContext({}),
            offset,
            1
          )
        )
      );

      expect(pages.map((page) => page.totalCount)).toEqual([2, 2]);
      expect(pages.flatMap(idsOf)).toEqual([
        eserviceComuneTwoCodes.id,
        eserviceComune.id,
      ]);
    });

    it("should return no e-service when no producer belongs to the category (producerCategories: SCUOLE)", async () => {
      const result = await filterEServices({ producerCategories: ["SCUOLE"] });

      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe("combined filters", () => {
    const attributeComune: Attribute = {
      ...getMockAttribute(),
      code: "L6",
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    };
    const comune: Tenant = {
      ...getMockTenant(),
      name: "Comune di Bologna",
      attributes: [
        {
          ...getMockCertifiedTenantAttribute(attributeComune.id),
          revocationTimestamp: undefined,
        },
      ],
    };
    const purposeTemplate = getMockPurposeTemplate(
      undefined,
      purposeTemplateState.published
    );

    const eserviceMatchingAll: EService = {
      ...buildEService("Anagrafe", new Date("2024-01-01T00:00:00Z")),
      producerId: comune.id,
      templateId: generateId<EServiceTemplateId>(),
    };
    const eserviceWrongProducer: EService = {
      ...buildEService("Anagrafe regionale", new Date("2024-02-01T00:00:00Z")),
      templateId: generateId<EServiceTemplateId>(),
    };
    const eserviceNoTemplate: EService = {
      ...buildEService("Anagrafe comunale", new Date("2024-03-01T00:00:00Z")),
      producerId: comune.id,
    };
    const eserviceNoLink: EService = {
      ...buildEService("Anagrafe storica", new Date("2024-04-01T00:00:00Z")),
      producerId: comune.id,
      templateId: generateId<EServiceTemplateId>(),
    };
    const eserviceWrongKeyword: EService = {
      ...buildEService("Tributi", new Date("2024-05-01T00:00:00Z")),
      producerId: comune.id,
      templateId: generateId<EServiceTemplateId>(),
    };

    beforeEach(async () => {
      await addOneAttribute(attributeComune);
      await addOneTenant(comune);
      await addOnePurposeTemplate(purposeTemplate);
      for (const eservice of [
        eserviceMatchingAll,
        eserviceWrongProducer,
        eserviceNoTemplate,
        eserviceNoLink,
        eserviceWrongKeyword,
      ]) {
        await addOneEService(eservice);
      }
      for (const eservice of [
        eserviceMatchingAll,
        eserviceWrongProducer,
        eserviceNoTemplate,
        eserviceWrongKeyword,
      ]) {
        await addOnePurposeTemplateEServiceDescriptor({
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice.id,
          descriptorId: eservice.descriptors[0].id,
          createdAt: new Date(),
        });
      }
    });

    it("should apply all the filters and the keyword together", async () => {
      const result = await filterEServices({
        keyword: "anagrafe",
        onlyTemplateInstances: true,
        hasLinkedPurposeTemplates: true,
        producerCategories: ["COMUNI"],
      });

      expect(result.totalCount).toBe(1);
      expect(idsOf(result)).toEqual([eserviceMatchingAll.id]);
    });
  });

  describe("availableForRequester", () => {
    const originalCertifiedDiscreteFlag =
      config.featureFlagAttributeCertifiedDiscrete;

    beforeEach(() => {
      config.featureFlagAttributeCertifiedDiscrete = true;
    });

    afterEach(() => {
      config.featureFlagAttributeCertifiedDiscrete =
        originalCertifiedDiscreteFlag;
    });

    describe("when the certified discrete feature flag is disabled", () => {
      const standardAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const discreteAttribute = getMockCertifiedDiscreteTenantAttribute();
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [standardAttribute, discreteAttribute],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const ownedStandard = {
        id: standardAttribute.id,
        explicitAttributeVerification: false,
      };
      const missingStandard = {
        id: generateId<AttributeId>(),
        explicitAttributeVerification: false,
      };
      const satisfiedDiscrete = {
        id: discreteAttribute.id,
        explicitAttributeVerification: false,
        discreteConfig: {
          comparator: attributeCertifiedDiscreteComparator.GTE,
          threshold: discreteAttribute.discreteValue,
        },
      };
      const unsatisfiedDiscrete = {
        ...satisfiedDiscrete,
        discreteConfig: {
          ...satisfiedDiscrete.discreteConfig,
          threshold: discreteAttribute.discreteValue + 1,
        },
      };
      const missingDiscrete = {
        ...satisfiedDiscrete,
        id: generateId<AttributeId>(),
      };

      beforeEach(async () => {
        config.featureFlagAttributeCertifiedDiscrete = false;
        await addOneTenant(requester);
      });

      it.each<{
        description: string;
        certified: Descriptor["attributes"]["certified"];
        available: boolean;
      }>([
        {
          description: "a satisfied discrete-only group",
          certified: [[satisfiedDiscrete]],
          available: true,
        },
        {
          description: "an unsatisfied discrete-only group",
          certified: [[unsatisfiedDiscrete]],
          available: true,
        },
        {
          description:
            "a discrete-only group with an attribute the requester does not own",
          certified: [[missingDiscrete]],
          available: true,
        },
        {
          description: "multiple unsatisfied discrete-only groups",
          certified: [[unsatisfiedDiscrete], [missingDiscrete]],
          available: true,
        },
        {
          description:
            "a satisfied standard group and an unsatisfied discrete-only group",
          certified: [[ownedStandard], [unsatisfiedDiscrete]],
          available: true,
        },
        {
          description:
            "an unsatisfied standard group and a satisfied discrete-only group",
          certified: [[missingStandard], [satisfiedDiscrete]],
          available: false,
        },
        {
          description:
            "a mixed group with a satisfied standard and an unsatisfied discrete requirement",
          certified: [[ownedStandard, unsatisfiedDiscrete]],
          available: true,
        },
        {
          description:
            "a mixed group with an unsatisfied standard and a satisfied discrete requirement",
          certified: [[missingStandard, satisfiedDiscrete]],
          available: false,
        },
        {
          description: "a mixed group with neither requirement satisfied",
          certified: [[missingStandard, unsatisfiedDiscrete]],
          available: false,
        },
      ])(
        "should ignore discrete requirements in $description",
        async ({ certified, available }) => {
          const eservice: EService = {
            ...buildEService(
              "Feature flag disabled",
              new Date("2024-01-01T00:00:00Z")
            ),
            descriptors: [
              {
                ...getPublishedDescriptor(),
                attributes: { certified, declared: [], verified: [] },
              },
            ],
          };
          await addOneEService(eservice);

          const availableResult = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );
          const unavailableResult = await filterEServices(
            { availableForRequester: false },
            requesterContext
          );
          const unfilteredResult = await filterEServices({}, requesterContext);

          expect(availableResult.totalCount).toBe(available ? 1 : 0);
          expect(idsOf(availableResult)).toEqual(
            available ? [eservice.id] : []
          );
          expect(unavailableResult.totalCount).toBe(available ? 0 : 1);
          expect(idsOf(unavailableResult)).toEqual(
            available ? [] : [eservice.id]
          );
          expect(unfilteredResult.totalCount).toBe(1);
          expect(idsOf(unfilteredResult)).toEqual([eservice.id]);
        }
      );
    });

    describe("when the filter is not set", () => {
      it("should not filter e-services when availableForRequester is not set", async () => {
        const requester: Tenant = {
          ...getMockTenant(),
          attributes: [],
        };
        const requesterContext = getMockContext({
          authData: getMockAuthData(requester.id),
        });
        const eserviceWithoutRequirements: EService = {
          ...buildEService(
            "Without requirements",
            new Date("2024-01-01T00:00:00Z")
          ),
          descriptors: [
            {
              ...getPublishedDescriptor(),
              attributes: { certified: [], declared: [], verified: [] },
            },
          ],
        };
        const eserviceWithUnmetRequirement: EService = {
          ...buildEService(
            "With unmet requirement",
            new Date("2024-02-01T00:00:00Z")
          ),
          descriptors: [
            {
              ...getPublishedDescriptor(),
              attributes: {
                certified: [
                  [{ id: generateId(), explicitAttributeVerification: false }],
                ],
                declared: [],
                verified: [],
              },
            },
          ],
        };

        await addOneTenant(requester);
        await addOneEService(eserviceWithoutRequirements);
        await addOneEService(eserviceWithUnmetRequirement);

        const result = await filterEServices({}, requesterContext);

        expect(result.totalCount).toBe(2);
        expect(idsOf(result)).toEqual([
          eserviceWithUnmetRequirement.id,
          eserviceWithoutRequirements.id,
        ]);
      });
    });

    describe("e-services without certified requirements", () => {
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const eserviceWithoutRequirements: EService = {
        ...buildEService(
          "Without requirements",
          new Date("2024-01-01T00:00:00Z")
        ),
        descriptors: [
          {
            ...getPublishedDescriptor(),
            attributes: { certified: [], declared: [], verified: [] },
          },
        ],
      };

      beforeEach(async () => {
        await addOneTenant(requester);
        await addOneEService(eserviceWithoutRequirements);
      });

      it("should consider an e-service without certified requirements available", async () => {
        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eserviceWithoutRequirements.id]);
      });

      it("should exclude an e-service without certified requirements when availableForRequester is false", async () => {
        const result = await filterEServices(
          { availableForRequester: false },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });
    });

    describe("standard certified requirements", () => {
      const certifiedAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const eserviceWithRequirement: EService = {
        ...buildEService(
          "With certified requirement",
          new Date("2024-01-01T00:00:00Z")
        ),
        descriptors: [
          {
            ...getPublishedDescriptor(),
            attributes: {
              certified: [
                [
                  {
                    id: certifiedAttribute.id,
                    explicitAttributeVerification: false,
                  },
                ],
              ],
              declared: [],
              verified: [],
            },
          },
        ],
      };

      beforeEach(async () => {
        await addOneEService(eserviceWithRequirement);
      });

      it("should return an e-service when the requester owns its certified requirement", async () => {
        await addOneTenant({
          ...requester,
          attributes: [certifiedAttribute],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eserviceWithRequirement.id]);
      });

      it("should exclude an e-service when the requester does not own its certified requirement", async () => {
        await addOneTenant({
          ...requester,
          attributes: [
            {
              ...getMockCertifiedTenantAttribute(),
              revocationTimestamp: undefined,
            },
          ],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should not consider a certified attribute owned by another tenant", async () => {
        await addOneTenant(requester);
        await addOneTenant({
          ...getMockTenant(),
          attributes: [certifiedAttribute],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should not satisfy a certified requirement with a revoked attribute", async () => {
        await addOneTenant({
          ...requester,
          attributes: [
            {
              ...certifiedAttribute,
              revocationTimestamp: new Date(),
            },
          ],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should not satisfy a standard certified requirement with a discrete certified attribute", async () => {
        await addOneTenant({
          ...requester,
          attributes: [
            getMockCertifiedDiscreteTenantAttribute(certifiedAttribute.id),
          ],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });
    });

    describe("certified requirement groups", () => {
      const certifiedAttributes = Array.from({ length: 4 }, () => ({
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      }));
      const [attributeA, attributeB, attributeC, attributeD] =
        certifiedAttributes;
      const requirementA = {
        id: attributeA.id,
        explicitAttributeVerification: false,
      };
      const requirementB = {
        id: attributeB.id,
        explicitAttributeVerification: false,
      };
      const requirementC = {
        id: attributeC.id,
        explicitAttributeVerification: false,
      };
      const requirementD = {
        id: attributeD.id,
        explicitAttributeVerification: false,
      };
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });

      const buildEServiceWithAttributeGroups = (
        certified: Descriptor["attributes"]["certified"]
      ): EService => ({
        ...buildEService(
          "With certified groups",
          new Date("2024-01-01T00:00:00Z")
        ),
        descriptors: [
          {
            ...getPublishedDescriptor(),
            attributes: { certified, declared: [], verified: [] },
          },
        ],
      });

      it("should consider a group satisfied when the requester owns at least one attribute in the group", async () => {
        const eservice = buildEServiceWithAttributeGroups([
          [requirementA, requirementB],
        ]);
        await addOneEService(eservice);
        await addOneTenant({
          ...requester,
          attributes: [attributeB],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eservice.id]);
      });

      it("should consider a group unsatisfied when the requester owns none of its attributes", async () => {
        const eservice = buildEServiceWithAttributeGroups([
          [requirementA, requirementB],
        ]);
        await addOneEService(eservice);
        await addOneTenant({
          ...requester,
          attributes: [attributeC],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should require at least one satisfied attribute in every certified group", async () => {
        const eservice = buildEServiceWithAttributeGroups([
          [requirementA, requirementB],
          [requirementC, requirementD],
        ]);
        await addOneEService(eservice);
        await addOneTenant({
          ...requester,
          attributes: [attributeA, attributeB],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should return an e-service when every certified group is satisfied", async () => {
        const eservice = buildEServiceWithAttributeGroups([
          [requirementA, requirementB],
          [requirementC, requirementD],
        ]);
        await addOneEService(eservice);
        await addOneTenant({
          ...requester,
          attributes: [attributeB, attributeD],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eservice.id]);
      });

      it.each(["standard", "discrete"] as const)(
        "should satisfy a group containing both standard and discrete requirements when at least one requirement is satisfied (%s)",
        async (satisfiedRequirement) => {
          const discreteAttribute = getMockCertifiedDiscreteTenantAttribute();
          const eservice = buildEServiceWithAttributeGroups([
            [
              requirementA,
              {
                id: discreteAttribute.id,
                explicitAttributeVerification: false,
                discreteConfig: {
                  comparator: attributeCertifiedDiscreteComparator.GTE,
                  threshold: discreteAttribute.discreteValue,
                },
              },
            ],
          ]);
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              satisfiedRequirement === "standard"
                ? attributeA
                : discreteAttribute,
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        }
      );
    });

    describe("discrete certified requirements", () => {
      const discreteAttribute = getMockCertifiedDiscreteTenantAttribute();
      const threshold = 10;
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const buildEServiceWithDiscreteRequirement = (
        comparator: AttributeCertifiedDiscreteComparator
      ): EService => ({
        ...buildEService(
          "With discrete certified requirement",
          new Date("2024-01-01T00:00:00Z")
        ),
        descriptors: [
          {
            ...getPublishedDescriptor(),
            attributes: {
              certified: [
                [
                  {
                    id: discreteAttribute.id,
                    explicitAttributeVerification: false,
                    discreteConfig: { comparator, threshold },
                  },
                ],
              ],
              declared: [],
              verified: [],
            },
          },
        ],
      });

      describe("GT comparator", () => {
        it("should satisfy a GT requirement when the requester value is greater than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.GT
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold + 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it("should not satisfy a GT requirement when the requester value is equal to the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.GT
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [{ ...discreteAttribute, discreteValue: threshold }],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });

        it("should not satisfy a GT requirement when the requester value is lower than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.GT
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold - 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });

      describe("LT comparator", () => {
        it("should satisfy an LT requirement when the requester value is lower than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.LT
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold - 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it("should not satisfy an LT requirement when the requester value is equal to the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.LT
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [{ ...discreteAttribute, discreteValue: threshold }],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });

        it("should not satisfy an LT requirement when the requester value is greater than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.LT
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold + 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });

      describe("EQ comparator", () => {
        it("should satisfy an EQ requirement when the requester value is equal to the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.EQ
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [{ ...discreteAttribute, discreteValue: threshold }],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it.each([threshold - 1, threshold + 1])(
          "should not satisfy an EQ requirement when the requester value is different from the threshold (%s)",
          async (discreteValue) => {
            const eservice = buildEServiceWithDiscreteRequirement(
              attributeCertifiedDiscreteComparator.EQ
            );
            await addOneEService(eservice);
            await addOneTenant({
              ...requester,
              attributes: [
                { ...discreteAttribute, discreteValue: discreteValue },
              ],
            });

            const result = await filterEServices(
              { availableForRequester: true },
              requesterContext
            );

            expect(result.totalCount).toBe(0);
            expect(result.results).toEqual([]);
          }
        );
      });

      describe("GTE comparator", () => {
        it("should satisfy a GTE requirement when the requester value is greater than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.GTE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold + 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it("should satisfy a GTE requirement when the requester value is equal to the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.GTE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [{ ...discreteAttribute, discreteValue: threshold }],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it("should not satisfy a GTE requirement when the requester value is lower than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.GTE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold - 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });

      describe("LTE comparator", () => {
        it("should satisfy an LTE requirement when the requester value is lower than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.LTE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold - 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it("should satisfy an LTE requirement when the requester value is equal to the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.LTE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [{ ...discreteAttribute, discreteValue: threshold }],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(1);
          expect(idsOf(result)).toEqual([eservice.id]);
        });

        it("should not satisfy an LTE requirement when the requester value is greater than the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.LTE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [
              { ...discreteAttribute, discreteValue: threshold + 1 },
            ],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });

      describe("NE comparator", () => {
        it.each([threshold - 1, threshold + 1])(
          "should satisfy an NE requirement when the requester value is different from the threshold (%s)",
          async (discreteValue) => {
            const eservice = buildEServiceWithDiscreteRequirement(
              attributeCertifiedDiscreteComparator.NE
            );
            await addOneEService(eservice);
            await addOneTenant({
              ...requester,
              attributes: [
                { ...discreteAttribute, discreteValue: discreteValue },
              ],
            });

            const result = await filterEServices(
              { availableForRequester: true },
              requesterContext
            );

            expect(result.totalCount).toBe(1);
            expect(idsOf(result)).toEqual([eservice.id]);
          }
        );

        it("should not satisfy an NE requirement when the requester value is equal to the threshold", async () => {
          const eservice = buildEServiceWithDiscreteRequirement(
            attributeCertifiedDiscreteComparator.NE
          );
          await addOneEService(eservice);
          await addOneTenant({
            ...requester,
            attributes: [{ ...discreteAttribute, discreteValue: threshold }],
          });

          const result = await filterEServices(
            { availableForRequester: true },
            requesterContext
          );

          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });

      it("should not satisfy a discrete certified requirement with a revoked attribute", async () => {
        const eservice = buildEServiceWithDiscreteRequirement(
          attributeCertifiedDiscreteComparator.EQ
        );
        await addOneEService(eservice);
        await addOneTenant({
          ...requester,
          attributes: [
            {
              ...discreteAttribute,
              discreteValue: threshold,
              revocationTimestamp: new Date(),
            },
          ],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should not consider a discrete certified attribute owned by another tenant", async () => {
        const eservice = buildEServiceWithDiscreteRequirement(
          attributeCertifiedDiscreteComparator.EQ
        );
        await addOneEService(eservice);
        await addOneTenant(requester);
        await addOneTenant({
          ...getMockTenant(),
          attributes: [{ ...discreteAttribute, discreteValue: threshold }],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should not satisfy a discrete certified requirement with a standard certified attribute", async () => {
        const eservice = buildEServiceWithDiscreteRequirement(
          attributeCertifiedDiscreteComparator.EQ
        );
        await addOneEService(eservice);
        await addOneTenant({
          ...requester,
          attributes: [
            {
              ...getMockCertifiedTenantAttribute(discreteAttribute.id),
              revocationTimestamp: undefined,
            },
          ],
        });

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });
    });

    describe("when availableForRequester is false", () => {
      const ownedAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const ownedRequirement = {
        id: ownedAttribute.id,
        explicitAttributeVerification: false,
      };
      const missingRequirement = {
        id: generateId<AttributeId>(),
        explicitAttributeVerification: false,
      };
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [ownedAttribute],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const buildDescriptor = (
        certified: Descriptor["attributes"]["certified"],
        state: Descriptor["state"] = descriptorState.published,
        version = "1"
      ): Descriptor => ({
        ...getPublishedDescriptor(),
        state,
        version,
        attributes: { certified, declared: [], verified: [] },
      });
      const buildTestEService = (
        name: string,
        descriptors: Descriptor[]
      ): EService => ({
        ...buildEService(name, new Date("2024-01-01T00:00:00Z")),
        descriptors,
      });

      beforeEach(async () => {
        await addOneTenant(requester);
      });

      it("should return only e-services with at least one unsatisfied certified group", async () => {
        const unavailable = buildTestEService("Unavailable", [
          buildDescriptor([[ownedRequirement], [missingRequirement]]),
        ]);
        const available = buildTestEService("Available", [
          buildDescriptor([[ownedRequirement]]),
        ]);
        const withoutRequirements = buildTestEService("Without requirements", [
          buildDescriptor([]),
        ]);
        await addOneEService(unavailable);
        await addOneEService(available);
        await addOneEService(withoutRequirements);

        const result = await filterEServices(
          { availableForRequester: false },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([unavailable.id]);
      });

      it("should exclude e-services whose certified groups are all satisfied", async () => {
        const secondAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        };
        await addOneTenant({
          ...requester,
          attributes: [ownedAttribute, secondAttribute],
        });
        await addOneEService(
          buildTestEService("Available", [
            buildDescriptor([
              [ownedRequirement, missingRequirement],
              [
                {
                  id: secondAttribute.id,
                  explicitAttributeVerification: false,
                },
              ],
            ]),
          ])
        );

        const result = await filterEServices(
          { availableForRequester: false },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(idsOf(result)).toEqual([]);
      });

      it("should exclude e-services without certified requirements", async () => {
        await addOneEService(
          buildTestEService("Without requirements", [buildDescriptor([])])
        );

        const result = await filterEServices(
          { availableForRequester: false },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(idsOf(result)).toEqual([]);
      });
    });

    describe("descriptor selection", () => {
      const ownedAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const ownedRequirement = {
        id: ownedAttribute.id,
        explicitAttributeVerification: false,
      };
      const missingRequirement = {
        id: generateId<AttributeId>(),
        explicitAttributeVerification: false,
      };
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [ownedAttribute],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const buildDescriptor = (
        certified: Descriptor["attributes"]["certified"],
        state: Descriptor["state"] = descriptorState.published,
        version = "1"
      ): Descriptor => ({
        ...getPublishedDescriptor(),
        state,
        version,
        attributes: { certified, declared: [], verified: [] },
      });
      const buildTestEService = (
        name: string,
        descriptors: Descriptor[]
      ): EService => ({
        ...buildEService(name, new Date("2024-01-01T00:00:00Z")),
        descriptors,
      });

      beforeEach(async () => {
        await addOneTenant(requester);
      });

      it("should evaluate certified requirements belonging to a published descriptor", async () => {
        const available = buildTestEService("Available", [
          buildDescriptor([[ownedRequirement]], descriptorState.published),
        ]);
        const unavailable = buildTestEService("Unavailable", [
          buildDescriptor([[missingRequirement]], descriptorState.published),
        ]);
        await addOneEService(available);
        await addOneEService(unavailable);

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([available.id]);
      });

      it("should evaluate certified requirements belonging to a suspended descriptor", async () => {
        const available = buildTestEService("Available", [
          buildDescriptor([[ownedRequirement]], descriptorState.suspended),
        ]);
        const unavailable = buildTestEService("Unavailable", [
          buildDescriptor([[missingRequirement]], descriptorState.suspended),
        ]);
        await addOneEService(available);
        await addOneEService(unavailable);

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([available.id]);
      });

      it("should ignore certified requirements belonging to a draft descriptor", async () => {
        const eservice = buildTestEService("Available", [
          buildDescriptor([[missingRequirement]], descriptorState.draft, "1"),
          buildDescriptor([[ownedRequirement]], descriptorState.published, "2"),
        ]);
        await addOneEService(eservice);

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eservice.id]);
      });

      it("should ignore certified requirements belonging to a deprecated descriptor", async () => {
        const eservice = buildTestEService("Available", [
          buildDescriptor(
            [[missingRequirement]],
            descriptorState.deprecated,
            "1"
          ),
          buildDescriptor([[ownedRequirement]], descriptorState.published, "2"),
        ]);
        await addOneEService(eservice);

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eservice.id]);
      });

      it("should evaluate availability against the relevant visible descriptor when multiple descriptor versions exist", async () => {
        const eservice = buildTestEService("Unavailable", [
          buildDescriptor(
            [[ownedRequirement]],
            descriptorState.deprecated,
            "1"
          ),
          buildDescriptor(
            [[missingRequirement]],
            descriptorState.published,
            "2"
          ),
          buildDescriptor([[ownedRequirement]], descriptorState.draft, "3"),
        ]);
        await addOneEService(eservice);

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(0);
        expect(idsOf(result)).toEqual([]);
        const unavailableResult = await filterEServices(
          { availableForRequester: false },
          requesterContext
        );

        expect(unavailableResult.totalCount).toBe(1);
        expect(idsOf(unavailableResult)).toEqual([eservice.id]);
      });
    });

    describe("interaction with other query features", () => {
      const ownedAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };
      const ownedRequirement = {
        id: ownedAttribute.id,
        explicitAttributeVerification: false,
      };
      const missingRequirement = {
        id: generateId<AttributeId>(),
        explicitAttributeVerification: false,
      };
      const requester: Tenant = {
        ...getMockTenant(),
        attributes: [ownedAttribute],
      };
      const requesterContext = getMockContext({
        authData: getMockAuthData(requester.id),
      });
      const buildDescriptor = (
        certified: Descriptor["attributes"]["certified"],
        state: Descriptor["state"] = descriptorState.published,
        version = "1"
      ): Descriptor => ({
        ...getPublishedDescriptor(),
        state,
        version,
        attributes: { certified, declared: [], verified: [] },
      });
      const buildTestEService = (
        name: string,
        descriptors: Descriptor[]
      ): EService => ({
        ...buildEService(name, new Date("2024-01-01T00:00:00Z")),
        descriptors,
      });

      beforeEach(async () => {
        await addOneTenant(requester);
      });

      it("should combine availableForRequester with the other catalog filters", async () => {
        const matching = buildTestEService("Catasto", [
          buildDescriptor([[ownedRequirement]]),
        ]);
        const unavailable = buildTestEService("Catasto unavailable", [
          buildDescriptor([[missingRequirement]]),
        ]);
        const otherProducer: EService = {
          ...buildTestEService("Catasto other producer", [
            buildDescriptor([[ownedRequirement]]),
          ]),
          producerId: generateId(),
        };
        const otherKeyword = buildTestEService("Anagrafe", [
          buildDescriptor([[ownedRequirement]]),
        ]);
        const suspended = buildTestEService("Catasto suspended", [
          buildDescriptor([[ownedRequirement]], descriptorState.suspended),
        ]);
        await addOneEService(matching);
        await addOneEService(unavailable);
        await addOneEService(otherProducer);
        await addOneEService(otherKeyword);
        await addOneEService(suspended);

        const result = await filterEServices(
          {
            availableForRequester: true,
            producersIds: [producerId],
            keyword: "Catasto",
            onlyActiveEservices: true,
          },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([matching.id]);
      });

      it("should preserve the filtered totalCount when results are paginated", async () => {
        const first = buildTestEService("Apple", [
          buildDescriptor([[ownedRequirement]]),
        ]);
        const excluded = buildTestEService("Banana", [
          buildDescriptor([[missingRequirement]]),
        ]);
        const second = buildTestEService("Cherry", [
          buildDescriptor([[ownedRequirement]]),
        ]);
        await addOneEService(second);
        await addOneEService(excluded);
        await addOneEService(first);

        const pages = await Promise.all(
          [0, 1, 2].map((offset) =>
            filterEServices(
              { availableForRequester: true, sortBy: "NAME_ASC" },
              requesterContext,
              offset,
              1
            )
          )
        );

        expect(pages.map((page) => page.totalCount)).toEqual([2, 2, 2]);
        expect(pages.map(idsOf)).toEqual([[first.id], [second.id], []]);
      });

      it("should not return duplicate e-services when a descriptor contains multiple satisfied attributes", async () => {
        const secondAttribute = {
          ...getMockCertifiedTenantAttribute(),
          revocationTimestamp: undefined,
        };
        await addOneTenant({
          ...requester,
          attributes: [ownedAttribute, secondAttribute],
        });
        const eservice = buildTestEService("Available", [
          buildDescriptor([
            [
              ownedRequirement,
              { id: secondAttribute.id, explicitAttributeVerification: false },
            ],
          ]),
        ]);
        await addOneEService(eservice);

        const result = await filterEServices(
          { availableForRequester: true },
          requesterContext
        );

        expect(result.totalCount).toBe(1);
        expect(idsOf(result)).toEqual([eservice.id]);
      });
    });
  });
});
