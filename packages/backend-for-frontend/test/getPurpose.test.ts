/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  purposeApi,
  catalogApi,
  agreementApi,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  EServiceId,
  PurposeId,
  UserId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { UIAuthData } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { purposeServiceBuilder } from "../src/services/purposeService.js";
import { fileManager, getBffMockContext } from "./utils.js";

/**
 * Builds minimal mock clients for purposeServiceBuilder.
 * Only the methods exercised by purposeService.getPurpose → enhancePurpose are mocked.
 */
function buildMockClients(overrides: {
  getPurpose: ReturnType<typeof vi.fn>;
  getEServiceById: ReturnType<typeof vi.fn>;
  getTenant: ReturnType<typeof vi.fn>;
  getAgreements: ReturnType<typeof vi.fn>;
  getUserInfoUsingGET?: ReturnType<typeof vi.fn>;
}): PagoPAInteropBeClients {
  return {
    purposeProcessClient: {
      getPurpose: overrides.getPurpose,
    },
    purposeTemplateProcessClient: {
      getPurposeTemplate: vi.fn(),
    },
    catalogProcessClient: {
      getEServiceById: overrides.getEServiceById,
    },
    tenantProcessClient: {
      tenant: {
        getTenant: overrides.getTenant,
      },
    },
    agreementProcessClient: {
      getAgreements: overrides.getAgreements,
    },
    authorizationClient: {
      client: {
        getClientsWithKeys: vi.fn().mockResolvedValue({ results: [] }),
      },
    },
    delegationProcessClient: {
      delegation: {},
    },
    selfcareV2UserClient: {
      getUserInfoUsingGET:
        overrides.getUserInfoUsingGET ?? vi.fn().mockResolvedValue({}),
    },
    inAppNotificationManagerClient: {
      filterUnreadNotifications: vi.fn().mockResolvedValue([]),
    },
    selfcareV2InstitutionClient: {},
    attributeProcessClient: {},
    eserviceTemplateProcessClient: {},
    notificationConfigProcessClient: {},
  } as unknown as PagoPAInteropBeClients;
}

function buildTestFixture() {
  const consumerId = generateId<TenantId>();
  const producerId = generateId<TenantId>();
  const reviewerId = generateId<UserId>();
  const purposeId = generateId<PurposeId>();
  const eserviceId = generateId<EServiceId>();
  const consumerSelfcareId = generateId();

  const descriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
  });

  const eservice = getMockedApiEservice({ descriptors: [descriptor] });
  eservice.id = eserviceId;
  // eslint-disable-next-line functional/immutable-data
  (eservice as { producerId: string }).producerId = producerId;
  eservice.mode = catalogApi.EServiceMode.Values.DELIVER;

  const consumer = getMockedApiTenant();
  consumer.id = consumerId;
  // eslint-disable-next-line functional/immutable-data
  (consumer as { selfcareId: string }).selfcareId = consumerSelfcareId;

  const producer = getMockedApiTenant();
  producer.id = producerId;

  const purpose: purposeApi.Purpose = {
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Test purpose",
    description: "Test description",
    isFreeOfCharge: false,
    createdAt: new Date().toISOString(),
    versions: [],
    reviewerWorkflow: {
      reviewMode:
        purposeApi.RiskAnalysisReviewMode.Values.REVIEWER_WRITES_REVIEWER_SIGNS,
      reviewerIds: [reviewerId],
      signingState: purposeApi.RiskAnalysisSigningState.Values.ASSIGNED,
    },
  };

  const agreement: agreementApi.Agreement = {
    id: generateId(),
    eserviceId,
    descriptorId: descriptor.id,
    producerId,
    consumerId,
    state: agreementApi.AgreementState.Values.ACTIVE,
    attributes: { certified: [], declared: [], verified: [] },
    consumerDocuments: [],
    stamps: {
      submission: undefined,
      activation: undefined,
      rejection: undefined,
      suspensionByProducer: undefined,
      suspensionByConsumer: undefined,
      upgrade: undefined,
      archiving: undefined,
    },
    createdAt: new Date().toISOString(),
  };

  const mockUserInfo: selfcareV2ClientApi.UserResponse = {
    id: reviewerId,
    name: "John",
    surname: "Doe",
  };

  return {
    consumerId,
    producerId,
    reviewerId,
    purposeId,
    eservice,
    consumer,
    producer,
    purpose,
    agreement,
    descriptor,
    consumerSelfcareId,
    mockUserInfo,
  };
}

describe("getPurpose (service) — reviewer enrichment", () => {
  it("should enrich reviewerWorkflow with reviewers when requester is the consumer", async () => {
    const {
      consumerId,
      eservice,
      consumer,
      producer,
      purpose,
      agreement,
      reviewerId,
      purposeId,
      mockUserInfo,
    } = buildTestFixture();

    const getUserInfoUsingGET = vi.fn().mockResolvedValue(mockUserInfo);

    const clients = buildMockClients({
      getPurpose: vi.fn().mockResolvedValue(purpose),
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenant: vi
        .fn()
        .mockImplementation(
          ({ params }: { params: { id: string } }) =>
            params.id === consumerId ? consumer : producer
        ),
      getAgreements: vi.fn().mockResolvedValue({ results: [agreement] }),
      getUserInfoUsingGET,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));
    const service = purposeServiceBuilder(clients, fileManager);

    const result = await service.getPurpose(purposeId, ctx);

    expect(result.reviewerWorkflow).toBeDefined();
    expect(result.reviewerWorkflow!.reviewers).toEqual([
      {
        userId: reviewerId,
        name: mockUserInfo.name,
        familyName: mockUserInfo.surname,
      },
    ]);
    expect(getUserInfoUsingGET).toHaveBeenCalledTimes(1);
    expect(getUserInfoUsingGET).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id: reviewerId },
      })
    );
  });

  it("should NOT include reviewers in reviewerWorkflow when requester is the producer", async () => {
    const {
      producerId,
      eservice,
      consumer,
      producer,
      purpose,
      agreement,
      purposeId,
    } = buildTestFixture();

    const getUserInfoUsingGET = vi.fn();

    const clients = buildMockClients({
      getPurpose: vi.fn().mockResolvedValue(purpose),
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenant: vi
        .fn()
        .mockImplementation(
          ({ params }: { params: { id: string } }) =>
            params.id === consumer.id ? consumer : producer
        ),
      getAgreements: vi.fn().mockResolvedValue({ results: [agreement] }),
      getUserInfoUsingGET,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: unsafeBrandId<TenantId>(producerId),
    };
    const ctx = getBffMockContext(getMockContext({ authData }));
    const service = purposeServiceBuilder(clients, fileManager);

    const result = await service.getPurpose(purposeId, ctx);

    expect(result.reviewerWorkflow).toBeDefined();
    expect(result.reviewerWorkflow!.reviewers).toBeUndefined();
    expect(getUserInfoUsingGET).not.toHaveBeenCalled();
  });

  it("should return empty reviewers array when reviewerIds is empty (consumer)", async () => {
    const { consumerId, eservice, consumer, producer, purpose, agreement, purposeId } =
      buildTestFixture();

    const purposeWithEmptyReviewers: purposeApi.Purpose = {
      ...purpose,
      reviewerWorkflow: {
        ...purpose.reviewerWorkflow!,
        reviewerIds: [],
      },
    };

    const getUserInfoUsingGET = vi.fn();

    const clients = buildMockClients({
      getPurpose: vi.fn().mockResolvedValue(purposeWithEmptyReviewers),
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenant: vi
        .fn()
        .mockImplementation(
          ({ params }: { params: { id: string } }) =>
            params.id === consumerId ? consumer : producer
        ),
      getAgreements: vi.fn().mockResolvedValue({ results: [agreement] }),
      getUserInfoUsingGET,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));
    const service = purposeServiceBuilder(clients, fileManager);

    const result = await service.getPurpose(purposeId, ctx);

    expect(result.reviewerWorkflow).toBeDefined();
    expect(result.reviewerWorkflow!.reviewers).toEqual([]);
    expect(getUserInfoUsingGET).not.toHaveBeenCalled();
  });

  it("should return undefined reviewerWorkflow when purpose has no reviewerWorkflow", async () => {
    const { consumerId, eservice, consumer, producer, purpose, agreement, purposeId } =
      buildTestFixture();

    const purposeWithoutWorkflow: purposeApi.Purpose = {
      ...purpose,
      reviewerWorkflow: undefined,
    };

    const getUserInfoUsingGET = vi.fn();

    const clients = buildMockClients({
      getPurpose: vi.fn().mockResolvedValue(purposeWithoutWorkflow),
      getEServiceById: vi.fn().mockResolvedValue(eservice),
      getTenant: vi
        .fn()
        .mockImplementation(
          ({ params }: { params: { id: string } }) =>
            params.id === consumerId ? consumer : producer
        ),
      getAgreements: vi.fn().mockResolvedValue({ results: [agreement] }),
      getUserInfoUsingGET,
    });

    const authData: UIAuthData = {
      ...getMockAuthData(),
      organizationId: consumerId,
    };
    const ctx = getBffMockContext(getMockContext({ authData }));
    const service = purposeServiceBuilder(clients, fileManager);

    const result = await service.getPurpose(purposeId, ctx);

    expect(result.reviewerWorkflow).toBeUndefined();
    expect(getUserInfoUsingGET).not.toHaveBeenCalled();
  });
});
