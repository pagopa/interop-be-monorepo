import { catalogApi } from "pagopa-interop-api-clients";
import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
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
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addOneAgreement,
  addOneDelegation,
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
});
