/* eslint-disable functional/no-let */

import path from "path";
import { fileURLToPath } from "url";
import {
  RefreshableInteropToken,
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
} from "pagopa-interop-commons-test/index.js";
import {
  EServiceId,
  PurposeEventEnvelopeV2,
  Tenant,
  TenantId,
  UserId,
  agreementState,
  generateId,
  purposeVersionState,
  toPurposeV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

import { handlePurposeMessageV2 } from "../../src/handler/handlePurposeMessageV2.js";
import {
  eServiceNotFound,
  tenantKindNotFound,
} from "../../src/model/errors.js";

describe("handleDelegationMessageV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);
  let mockRefreshableToken: RefreshableInteropToken;

  it("should write on event-store for the activation of a purpose version in the waiting for approval state", async () => {
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
      state: purposeVersionState.waitingForApproval,
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

    const mockEvent: PurposeEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurpose.id,
      version: 1,
      event_version: 2,
      type: "PurposeActivated",
      data: { purpose: toPurposeV2(mockPurpose) },
      log_date: new Date(),
    };

    await handlePurposeMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
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
      date: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
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
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
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
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
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
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        genericLogger
      )
    ).rejects.toThrow(tenantKindNotFound(mockConsumer.id).message);
  });
});
