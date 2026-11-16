/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  RefreshableInteropToken,
  dateAtRomeZone,
  genericLogger,
} from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  EService,
  EServiceId,
  Purpose,
  PurposeEventEnvelopeV2,
  Tenant,
  TenantId,
  UserId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  purposeVersionState,
  riskAnalysisReviewMode,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import path from "path";
import { fileURLToPath } from "url";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";

import { getInteropBeClients } from "../../src/clients/clientProvider.js";
import { config } from "../../src/config/config.js";
import { handlePurposeMessageV2 } from "../../src/handler/handlePurposeMessageV2.js";
import {
  eServiceNotFound,
  tenantKindNotFound,
} from "../../src/model/errors.js";
import { getIpaCode } from "../../src/pdf-generator/pdfGenerator.js";
import {
  RiskAnalysisDocumentBuilder,
  riskAnalysisDocumentBuilder,
} from "../../src/service/purpose/purposeContractBuilder.js";
import {
  cleanup,
  pdfGenerator,
  addOnePurpose,
  addOneEService,
  addOneAgreement,
  addOneTenant,
  addOneDelegation,
  fileManager,
  readModelService,
} from "../integrationUtils.js";
const clients = getInteropBeClients();
const riskAnalysisContractInstance: RiskAnalysisDocumentBuilder =
  riskAnalysisDocumentBuilder(pdfGenerator, fileManager, config, genericLogger);
export const mockAddUnsignedRiskAnalysysContractMetadataFn = vi.fn();
vi.mock("pagopa-interop-api-clients", () => ({
  delegationApi: {
    createDelegationApiClient: vi.fn(),
  },
  agreementApi: {
    createAgreementApiClient: vi.fn(),
  },
  purposeApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createPurposeApiClient: () => ({
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      get addUnsignedRiskAnalysisDocumentMetadata() {
        return mockAddUnsignedRiskAnalysysContractMetadataFn;
      },
    }),
  },
  purposeTemplateApi: {
    createPurposeTemplateApiClient: vi.fn(),
  },
}));
describe("handleDelegationMessageV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const testToken = "mockToken";

  const testHeaders = {
    "X-Correlation-Id": generateId(),
    Authorization: `Bearer ${testToken}`,
  };

  let mockRefreshableToken: RefreshableInteropToken;

  beforeAll(() => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as RefreshableInteropToken;
  });
  afterEach(cleanup);

  it("should write on event-store for the activation of a purpose version in the waiting for approval state and call purpose-process", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const mockUserId = generateId<UserId>();
    const mockReviewerId = generateId<UserId>();
    const mockConsumer: Tenant = {
      ...getMockTenant(),
      kind: "PA",
    };

    const mockProducer: Tenant = {
      ...getMockTenant(),
      kind: "PA",
    };

    const mockEServiceDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 20,
    };

    const mockEService = {
      ...getMockEService(),
      producerId: mockProducer.id,
      descriptors: [mockEServiceDescriptor],
    };

    const mockAgreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: mockConsumer.id,
      descriptorId: mockEService.descriptors[0].id,
      state: agreementState.active,
    };

    const mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
      stamps: {
        creation: {
          who: mockUserId,
          when: new Date(),
        },
      },
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockAgreement.consumerId,
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: mockReviewerId, sentToReviewerAt: new Date() }],
        signingState: "Signed",
        signedBy: mockReviewerId,
        rejectionReason: undefined,
        sentToReviewerAt: new Date(),
      },
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const mockEvent: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeActivated",
      data: { purpose: toPurposeV2(mockPurpose) },
      log_date: new Date(),
      correlation_id: generateId(),
    };

    testHeaders["X-Correlation-Id"] = unsafeBrandId<CorrelationId>(
      mockEvent.correlation_id!
    );

    await handlePurposeMessageV2(
      mockEvent,
      readModelService,
      mockRefreshableToken,
      riskAnalysisContractInstance,
      clients,
      genericLogger
    );
    const expectedPdfPayload = {
      dailyCalls: mockPurposeVersion.dailyCalls.toString(),
      answers: expect.any(String),
      eServiceName: mockEService.name,
      producerName: mockProducer.name,
      producerIpaCode: getIpaCode(mockProducer),
      consumerName: mockConsumer.name,
      consumerIpaCode: getIpaCode(mockConsumer),
      freeOfCharge: expect.any(String),
      freeOfChargeReason: expect.any(String),
      date: dateAtRomeZone(mockEvent.log_date),
      eServiceMode: "Eroga",
      producerDelegationId: undefined,
      producerDelegateName: undefined,
      producerDelegateIpaCode: undefined,
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
      userId: mockUserId,
      consumerId: mockConsumer.id,
      reviewerId: mockReviewerId,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/purpose",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );
    expect(mockAddUnsignedRiskAnalysysContractMetadataFn).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/pdf",
        createdAt: expect.any(String),
        id: expect.any(String),
        path: expect.any(String),
      }),

      expect.objectContaining({
        params: {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        headers: testHeaders,
      })
    );
  });
  it("should compose AOO/UO names with their parent and root tenants in the risk analysis payload", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const rootTenant: Tenant = { ...getMockTenant(), name: "Comune di Roma" };
    const mockProducer: Tenant = {
      ...getMockTenant(),
      kind: "PA",
      name: "AOO Protocollo",
      subUnitType: "AOO",
      parentTenantId: rootTenant.id,
      rootTenantId: rootTenant.id,
    };
    const mockConsumer: Tenant = {
      ...getMockTenant(),
      kind: "PA",
      name: "UO Servizi",
      subUnitType: "UO",
      parentTenantId: mockProducer.id,
      rootTenantId: rootTenant.id,
    };
    const mockConsumerDelegate: Tenant = {
      ...getMockTenant(),
      name: "AOO Delegata",
      subUnitType: "AOO",
      parentTenantId: rootTenant.id,
      rootTenantId: rootTenant.id,
    };
    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducer.id,
      descriptors: [getMockDescriptorPublished()],
    };
    const mockConsumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegatorId: mockConsumer.id,
      delegateId: mockConsumerDelegate.id,
      state: delegationState.active,
      eserviceId: mockEService.id,
    });
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockConsumer.id,
      eserviceId: mockEService.id,
      delegationId: mockConsumerDelegation.id,
      versions: [
        {
          ...getMockPurposeVersion(),
          state: purposeVersionState.active,
          stamps: {
            creation: { who: generateId<UserId>(), when: new Date() },
          },
        },
      ],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneTenant(rootTenant);
    await addOneTenant(mockProducer);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockConsumerDelegate);
    await addOneDelegation(mockConsumerDelegation);

    await handlePurposeMessageV2(
      {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 1,
        event_version: 2,
        type: "PurposeActivated",
        data: { purpose: toPurposeV2(mockPurpose) },
        log_date: new Date(),
      },
      readModelService,
      mockRefreshableToken,
      riskAnalysisContractInstance,
      clients,
      genericLogger
    );

    expect(pdfGenerator.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        producerName: "AOO Protocollo - Comune di Roma",
        consumerName: "UO Servizi - AOO Protocollo - Comune di Roma",
        consumerDelegateName: "AOO Delegata - Comune di Roma",
      })
    );
  });

  it("should not process events that don't require contract generation and only log an info message", async () => {
    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: generateId<TenantId>(),
      eserviceId: generateId<EServiceId>(),
      versions: [],
    };

    const mockEvent: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeAdded",
      data: { purpose: toPurposeV2(mockPurpose) },
      log_date: new Date(),
    };

    const pdfGeneratorSpy = vi.spyOn(pdfGenerator, "generate");
    const fileManagerSpy = vi.spyOn(fileManager, "storeBytes");

    await expect(
      handlePurposeMessageV2(
        mockEvent,
        readModelService,
        mockRefreshableToken,
        riskAnalysisContractInstance,
        clients,
        genericLogger
      )
    ).resolves.toBeUndefined();

    expect(pdfGeneratorSpy).not.toHaveBeenCalled();
    expect(fileManagerSpy).not.toHaveBeenCalled();
  });
  it("should throw eServiceNotFound if EService is missing for an 'activated' event", async () => {
    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: generateId<TenantId>(),
      eserviceId: generateId<EServiceId>(),
      versions: [],
    };

    const mockEvent: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeActivated",
      data: { purpose: toPurposeV2(mockPurpose) },
      log_date: new Date(),
    };

    await expect(
      handlePurposeMessageV2(
        mockEvent,
        readModelService,
        mockRefreshableToken,
        riskAnalysisContractInstance,
        clients,
        genericLogger
      )
    ).rejects.toThrow(eServiceNotFound(mockPurpose.eserviceId).message);
  });
  it("should throw tenantKindNotFound if tenantKind is not found", async () => {
    const mockConsumer: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };
    const mockProducer: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };

    const mockEService = {
      ...getMockEService(),
      producerId: mockProducer.id,
      descriptors: [],
    };
    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockConsumer.id,
      eserviceId: mockEService.id,
      versions: [],
    };

    await addOneEService(mockEService);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const mockEvent: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeActivated",
      data: { purpose: toPurposeV2(mockPurpose) },
      log_date: new Date(),
    };

    await expect(
      handlePurposeMessageV2(
        mockEvent,
        readModelService,
        mockRefreshableToken,
        riskAnalysisContractInstance,
        clients,
        genericLogger
      )
    ).rejects.toThrow(tenantKindNotFound(mockConsumer.id).message);
  });
});
