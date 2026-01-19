/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from "path";
import { fileURLToPath } from "url";
import {
  RefreshableInteropToken,
  dateAtRomeZone,
  genericLogger,
  getIpaCode,
} from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockValidRiskAnalysisForm,
  toPurposeV1,
} from "pagopa-interop-commons-test/index.js";
import {
  CorrelationId,
  EServiceId,
  PurposeEventEnvelopeV1,
  Tenant,
  TenantId,
  UserId,
  agreementState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
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
import {
  cleanup,
  pdfGenerator,
  addOnePurpose,
  addOneEService,
  addOneAgreement,
  addOneTenant,
  fileManager,
  readModelService,
} from "../integrationUtils.js";

import { handlePurposeMessageV1 } from "../../src/handler/handlePurposeMessageV1.js";
import {
  eServiceNotFound,
  tenantKindNotFound,
} from "../../src/model/errors.js";
import { getInteropBeClients } from "../../src/clients/clientProvider.js";
import { config } from "../../src/config/config.js";
import {
  RiskAnalysisDocumentBuilder,
  riskAnalysisDocumentBuilder,
} from "../../src/service/purpose/purposeContractBuilder.js";
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
}));
describe("handlePurposeMessageV1", () => {
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

  it("should write on event-store for the activation of a purpose version and call purpose-process", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const mockUserId = generateId<UserId>();
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
      stamps: {
        creation: {
          who: mockUserId,
          when: new Date(),
        },
      },
    };

    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockAgreement.consumerId,
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const mockEvent: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 1,
      type: "PurposeVersionActivated",
      data: { purpose: toPurposeV1(mockPurpose) },
      log_date: new Date(),
      correlation_id: generateId(),
    };

    testHeaders["X-Correlation-Id"] = unsafeBrandId<CorrelationId>(
      mockEvent.correlation_id!
    );

    await handlePurposeMessageV1(
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
  it("should not process events that don't require contract generation and only log an info message", async () => {
    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: generateId<TenantId>(),
      eserviceId: generateId<EServiceId>(),
      versions: [],
    };

    const mockEvent: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 1,
      type: "PurposeCreated",
      data: { purpose: toPurposeV1(mockPurpose) },
      log_date: new Date(),
    };

    const pdfGeneratorSpy = vi.spyOn(pdfGenerator, "generate");
    const fileManagerSpy = vi.spyOn(fileManager, "storeBytes");

    await expect(
      handlePurposeMessageV1(
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
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: generateId<TenantId>(),
      eserviceId: generateId<EServiceId>(),
      versions: [mockPurposeVersion],
    };

    const mockEvent: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 1,
      type: "PurposeVersionActivated",
      data: { purpose: toPurposeV1(mockPurpose) },
      log_date: new Date(),
    };

    await expect(
      handlePurposeMessageV1(
        mockEvent,
        readModelService,
        mockRefreshableToken,
        riskAnalysisContractInstance,
        clients,
        genericLogger
      )
    ).rejects.toThrow(eServiceNotFound(mockPurpose.eserviceId).message);
  });
  it("should throw tenantKindNotFound if consumer tenantKind is not found", async () => {
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
    const mockPurposeVersion = getMockPurposeVersion();
    const mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockConsumer.id,
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOneEService(mockEService);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const mockEvent: PurposeEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 1,
      type: "PurposeVersionActivated",
      data: { purpose: toPurposeV1(mockPurpose) },
      log_date: new Date(),
    };

    await expect(
      handlePurposeMessageV1(
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
