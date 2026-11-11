import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  eserviceTemplateApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { AuthData, genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { EServiceId, generateId, TenantId } from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthorizationProcessClient,
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { config } from "../src/config/config.js";
import { UseCasesLanguage } from "../src/model/types.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import {
  getMockCatalogApiEService,
  getMockCatalogApiEServiceDescriptor,
} from "./mockUtils.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getCatalogUseCases", () => {
  const italian = UseCasesLanguage.enum.it;
  const english = UseCasesLanguage.enum.en;
  const useCaseFieldId = bffApi.CatalogUseCaseField.enum.WELFARE;

  const requesterId: TenantId = generateId<TenantId>();
  const producerId: TenantId = generateId<TenantId>();
  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: requesterId,
  };
  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  const getMockEService = (
    eserviceProducerId: TenantId = producerId
  ): catalogApi.EService & { id: EServiceId } => ({
    ...getMockCatalogApiEService(),
    producerId: eserviceProducerId,
    descriptors: [
      {
        ...getMockCatalogApiEServiceDescriptor(),
        version: "1",
        state: "PUBLISHED",
        archivingSchedule: undefined,
      },
    ],
  });

  const tenants: Record<string, { id: string; name: string }> = {
    [requesterId]: { id: requesterId, name: "Requester" },
    [producerId]: { id: producerId, name: "Producer" },
  };

  const getEServices = vi.fn();
  const getAgreements = vi.fn();
  const filterUnreadNotifications = vi.fn();
  const getTenant = vi.fn(({ params }: { params: { id: string } }) =>
    Promise.resolve(tenants[params.id])
  );

  const catalogService = catalogServiceBuilder(
    { getEServices } as unknown as catalogApi.CatalogProcessClient,
    {
      tenant: { getTenant },
    } as unknown as TenantProcessClient,
    { getAgreements } as unknown as agreementApi.AgreementProcessClient,
    {} as unknown as attributeRegistryApi.AttributeProcessClient,
    {} as unknown as AuthorizationProcessClient,
    {} as unknown as DelegationProcessClient,
    {} as unknown as eserviceTemplateApi.EServiceTemplateProcessClient,
    {
      filterUnreadNotifications,
    } as unknown as inAppNotificationApi.InAppNotificationManagerClient,
    fileManager,
    config
  );

  const storeUseCasesFile = async (
    language: UseCasesLanguage,
    content: string
  ): Promise<void> => {
    await fileManager.storeBytes(
      {
        bucket: config.useCasesContainer,
        path: `${config.useCasesPath}/${language}`,
        name: config.useCasesFileName,
        content: Buffer.from(content),
      },
      genericLogger
    );
  };

  const toUseCaseFileItem = (
    name: string,
    eserviceIds: string[]
  ): Record<string, unknown> => ({
    name,
    description: `${name} description`,
    slug: `${name}-slug`,
    fieldId: useCaseFieldId,
    eserviceIds,
  });

  const toExpectedCatalogEService = (
    eservice: catalogApi.EService
  ): bffApi.CatalogEService => ({
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: {
      id: eservice.producerId,
      name: tenants[eservice.producerId].name,
      selfcareId: undefined,
    },
    isMine: eservice.producerId === requesterId,
    activeDescriptor: {
      id: eservice.descriptors[0].id,
      version: eservice.descriptors[0].version,
      audience: eservice.descriptors[0].audience,
      state: eservice.descriptors[0].state,
      archivableOn: undefined,
    },
    hasUnreadNotifications: false,
    personalData: eservice.personalData,
    asyncExchange: eservice.asyncExchange,
  });

  const mockEServices = (eservices: catalogApi.EService[]): void => {
    getEServices.mockImplementation(
      ({ queries }: { queries: catalogApi.GetEServicesQueryParams }) => {
        const found = eservices.filter((e) =>
          queries.eservicesIds?.includes(e.id)
        );
        return Promise.resolve({
          results: found.slice(queries.offset, queries.offset + queries.limit),
          totalCount: found.length,
        });
      }
    );
  };

  const mockAgreements = (agreements: agreementApi.Agreement[]): void => {
    getAgreements.mockImplementation(
      ({ queries }: { queries: agreementApi.GetAgreementsQueryParams }) =>
        Promise.resolve({
          results: agreements.slice(
            queries.offset,
            queries.offset + queries.limit
          ),
          totalCount: agreements.length,
        })
    );
  };

  const getAgreementOn = (
    eservice: catalogApi.EService,
    state: agreementApi.AgreementState,
    descriptorId: string = eservice.descriptors[0].id
  ): agreementApi.Agreement =>
    getMockedApiAgreement({
      state,
      eserviceId: eservice.id,
      descriptorId,
      consumerId: requesterId,
    });

  const getUseCasesFileItems = (eservices: catalogApi.EService[]): string =>
    JSON.stringify([
      toUseCaseFileItem(
        "use case",
        eservices.map((e) => e.id)
      ),
    ]);

  const getNames = (useCases: bffApi.CatalogUseCase[]): string[] =>
    useCases.map((useCase) => useCase.name);

  beforeEach(() => {
    getEServices.mockReset();
    getAgreements.mockReset();
    getTenant.mockClear();
    filterUnreadNotifications.mockReset();
    filterUnreadNotifications.mockResolvedValue([]);
    mockEServices([]);
    mockAgreements([]);
  });

  describe("language", () => {
    const italianEService = getMockEService();
    const englishEService = getMockEService();

    beforeEach(async () => {
      mockEServices([italianEService, englishEService]);
      await storeUseCasesFile(
        italian,
        JSON.stringify([toUseCaseFileItem(italian, [italianEService.id])])
      );
    });

    it("should read the file of the requested language", async () => {
      await storeUseCasesFile(
        english,
        JSON.stringify([toUseCaseFileItem(english, [englishEService.id])])
      );

      const result = await catalogService.getCatalogUseCases(
        bffMockContext,
        english
      );

      expect(getNames(result)).toEqual([english]);
    });

    it("should read the italian file for the italian language", async () => {
      const result = await catalogService.getCatalogUseCases(
        bffMockContext,
        italian
      );

      expect(getNames(result)).toEqual([italian]);
    });

    it("should fall back to the italian file when the file of the language is missing", async () => {
      const result = await catalogService.getCatalogUseCases(
        bffMockContext,
        english
      );

      expect(getNames(result)).toEqual([italian]);
    });

    it("should fall back to the italian file when the file of the language is not valid", async () => {
      await storeUseCasesFile(english, "not a json");

      const result = await catalogService.getCatalogUseCases(
        bffMockContext,
        english
      );

      expect(getNames(result)).toEqual([italian]);
    });

    it("should fall back to the italian file when the file of the language does not match the schema", async () => {
      await storeUseCasesFile(
        english,
        JSON.stringify([
          { ...toUseCaseFileItem(english, []), fieldId: "OTHER" },
        ])
      );

      const result = await catalogService.getCatalogUseCases(
        bffMockContext,
        english
      );

      expect(getNames(result)).toEqual([italian]);
    });

    it("should not fall back to the italian file when the file of the language is empty", async () => {
      await storeUseCasesFile(english, JSON.stringify([]));

      expect(
        await catalogService.getCatalogUseCases(bffMockContext, english)
      ).toEqual([]);
      expect(getEServices).not.toHaveBeenCalled();
    });
  });

  it("should return an empty array when the italian file is missing", async () => {
    expect(
      await catalogService.getCatalogUseCases(bffMockContext, english)
    ).toEqual([]);
    expect(getEServices).not.toHaveBeenCalled();
  });

  it("should return an empty array when the italian file is not valid", async () => {
    await storeUseCasesFile(italian, "not a json");

    expect(
      await catalogService.getCatalogUseCases(bffMockContext, italian)
    ).toEqual([]);
  });

  it("should retrieve each e-service once, also when it is in more use cases", async () => {
    const eservice1 = getMockEService();
    const eservice2 = getMockEService();
    mockEServices([eservice1, eservice2]);
    await storeUseCasesFile(
      italian,
      JSON.stringify([
        toUseCaseFileItem("first", [eservice1.id, eservice2.id]),
        toUseCaseFileItem("second", [eservice2.id]),
      ])
    );

    await catalogService.getCatalogUseCases(bffMockContext, italian);

    expect(getEServices).toHaveBeenCalledExactlyOnceWith({
      headers: bffMockContext.headers,
      queries: {
        offset: 0,
        limit: 50,
        eservicesIds: [eservice1.id, eservice2.id],
      },
    });
    expect(getAgreements).toHaveBeenCalledExactlyOnceWith({
      headers: bffMockContext.headers,
      queries: {
        consumersIds: [requesterId],
        eservicesIds: [eservice1.id, eservice2.id],
        exactConsumerIdMatch: true,
        offset: 0,
        limit: 50,
      },
    });
  });

  it("should retrieve all the pages of e-services and agreements", async () => {
    const eservices = Array.from({ length: 51 }, () => getMockEService());
    mockEServices(eservices);
    mockAgreements(eservices.map((e) => getAgreementOn(e, "ACTIVE")));
    await storeUseCasesFile(
      italian,
      JSON.stringify([
        toUseCaseFileItem(
          "many",
          eservices.map((e) => e.id)
        ),
      ])
    );

    const [useCase] = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(getEServices).toHaveBeenCalledTimes(2);
    expect(getAgreements).toHaveBeenCalledTimes(2);
    expect(useCase.subscribedEservices).toHaveLength(51);
    expect(useCase.unsubscribedEservices).toEqual([]);
  });

  it("should not retrieve e-services when no use case has e-services", async () => {
    await storeUseCasesFile(
      italian,
      JSON.stringify([toUseCaseFileItem("empty", [])])
    );

    const result = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(getEServices).not.toHaveBeenCalled();
    expect(getAgreements).not.toHaveBeenCalled();
    expect(getTenant).not.toHaveBeenCalled();
    expect(filterUnreadNotifications).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        name: "empty",
        description: "empty description",
        slug: "empty-slug",
        fieldId: useCaseFieldId,
        subscribedEservices: [],
        unsubscribedEservices: [],
      },
    ]);
  });

  it("should return the use cases with the subscribed and unsubscribed e-services", async () => {
    const pending = getMockEService();
    const active = getMockEService();
    const suspended = getMockEService();
    const draft = getMockEService();
    const archived = getMockEService();
    const rejected = getMockEService();
    const missingCertifiedAttributes = getMockEService();
    const withoutAgreement = getMockEService();
    const eservices = [
      pending,
      active,
      suspended,
      draft,
      archived,
      rejected,
      missingCertifiedAttributes,
      withoutAgreement,
    ];
    mockEServices(eservices);
    mockAgreements([
      getAgreementOn(pending, "PENDING"),
      getAgreementOn(active, "ACTIVE"),
      getAgreementOn(suspended, "SUSPENDED"),
      getAgreementOn(draft, "DRAFT"),
      getAgreementOn(archived, "ARCHIVED"),
      getAgreementOn(rejected, "REJECTED"),
      getAgreementOn(
        missingCertifiedAttributes,
        "MISSING_CERTIFIED_ATTRIBUTES"
      ),
    ]);
    await storeUseCasesFile(italian, getUseCasesFileItems(eservices));

    const result = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(result).toEqual([
      {
        name: "use case",
        description: "use case description",
        slug: "use case-slug",
        fieldId: useCaseFieldId,
        subscribedEservices: [pending, active, suspended].map(
          toExpectedCatalogEService
        ),
        unsubscribedEservices: [
          draft,
          archived,
          rejected,
          missingCertifiedAttributes,
          withoutAgreement,
        ].map(toExpectedCatalogEService),
      },
    ]);
  });

  it("should consider subscribed an e-service with an active agreement and an upgrade draft", async () => {
    const eservice: catalogApi.EService = {
      ...getMockEService(),
      descriptors: [
        {
          ...getMockCatalogApiEServiceDescriptor(),
          version: "1",
          state: "DEPRECATED",
          archivingSchedule: undefined,
        },
        {
          ...getMockCatalogApiEServiceDescriptor(),
          version: "2",
          state: "PUBLISHED",
          archivingSchedule: undefined,
        },
      ],
    };
    mockEServices([eservice]);
    mockAgreements([
      getAgreementOn(eservice, "ACTIVE", eservice.descriptors[0].id),
      getAgreementOn(eservice, "DRAFT", eservice.descriptors[1].id),
    ]);
    await storeUseCasesFile(italian, getUseCasesFileItems([eservice]));

    const [useCase] = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(useCase.subscribedEservices.map((e) => e.id)).toEqual([eservice.id]);
    expect(useCase.unsubscribedEservices).toEqual([]);
  });

  it("should return once an e-service repeated in the same use case", async () => {
    const eservice = getMockEService();
    mockEServices([eservice]);
    await storeUseCasesFile(
      italian,
      getUseCasesFileItems([eservice, eservice])
    );

    const [useCase] = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(useCase.unsubscribedEservices).toEqual([
      toExpectedCatalogEService(eservice),
    ]);
  });

  it("should map the requester e-services and their unread notifications", async () => {
    const ownEService = getMockEService(requesterId);
    mockEServices([ownEService]);
    filterUnreadNotifications.mockResolvedValue([ownEService.id]);
    await storeUseCasesFile(italian, getUseCasesFileItems([ownEService]));

    const [useCase] = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(useCase.unsubscribedEservices).toEqual([
      {
        ...toExpectedCatalogEService(ownEService),
        isMine: true,
        hasUnreadNotifications: true,
      },
    ]);
  });

  it("should ignore the e-services that are not found", async () => {
    const found = getMockEService();
    const notFoundId = generateId<EServiceId>();
    mockEServices([found]);
    await storeUseCasesFile(
      italian,
      JSON.stringify([
        toUseCaseFileItem("with found", [notFoundId, found.id]),
        toUseCaseFileItem("only not found", [notFoundId]),
      ])
    );

    const result = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(
      result.map(({ name, subscribedEservices, unsubscribedEservices }) => ({
        name,
        subscribedEservices,
        unsubscribedEservices,
      }))
    ).toEqual([
      {
        name: "with found",
        subscribedEservices: [],
        unsubscribedEservices: [toExpectedCatalogEService(found)],
      },
      {
        name: "only not found",
        subscribedEservices: [],
        unsubscribedEservices: [],
      },
    ]);
  });

  it("should return the use case without description when it is not in the file", async () => {
    await storeUseCasesFile(
      italian,
      JSON.stringify([
        {
          name: "no description",
          slug: "no description-slug",
          fieldId: useCaseFieldId,
          eserviceIds: [],
        },
      ])
    );

    const result = await catalogService.getCatalogUseCases(
      bffMockContext,
      italian
    );

    expect(result).toEqual([
      {
        name: "no description",
        description: undefined,
        slug: "no description-slug",
        fieldId: useCaseFieldId,
        subscribedEservices: [],
        unsubscribedEservices: [],
      },
    ]);
  });

  it("should throw when the e-services cannot be retrieved", async () => {
    const eservice = getMockEService();
    const error = new Error("catalog process error");
    getEServices.mockRejectedValue(error);
    await storeUseCasesFile(italian, getUseCasesFileItems([eservice]));

    await expect(
      catalogService.getCatalogUseCases(bffMockContext, italian)
    ).rejects.toThrow(error);
  });

  it("should throw when the agreements cannot be retrieved", async () => {
    const eservice = getMockEService();
    const error = new Error("agreement process error");
    mockEServices([eservice]);
    getAgreements.mockRejectedValue(error);
    await storeUseCasesFile(italian, getUseCasesFileItems([eservice]));

    await expect(
      catalogService.getCatalogUseCases(bffMockContext, italian)
    ).rejects.toThrow(error);
  });
});
