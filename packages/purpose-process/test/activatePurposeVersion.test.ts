/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-floating-promises */

import path from "path";
import { fileURLToPath } from "url";
import {
  getMockPurposeVersion,
  getMockPurpose,
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockValidRiskAnalysisForm,
  readLastEventByStreamId,
  decodeProtobufPayload,
  getMockDelegation,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  Tenant,
  EService,
  Agreement,
  Descriptor,
  agreementState,
  TenantKind,
  PurposeActivatedV2,
  toPurposeV2,
  PurposeVersionUnsuspendedByConsumerV2,
  PurposeVersionUnsuspendedByProducerV2,
  PurposeVersionOverQuotaUnsuspendedV2,
  PurposeWaitingForApprovalV2,
  eserviceMode,
  PurposeVersionActivatedV2,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  genericLogger,
  getIpaCode,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  tenantKindNotFound,
  missingRiskAnalysis,
  eserviceNotFound,
  organizationNotAllowed,
  riskAnalysisValidationFailed,
  organizationIsNotTheProducer,
  organizationIsNotTheConsumer,
  tenantNotFound,
  agreementNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { RiskAnalysisDocumentPDFPayload } from "../src/model/domain/models.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  fileManager,
  pdfGenerator,
  postgresDB,
  purposeService,
} from "./utils.js";
import { addOnePurpose } from "./utils.js";

describe("activatePurposeVersion", () => {
  let mockConsumer: Tenant;
  let mockProducer: Tenant;
  let mockEService: EService;
  let mockAgreement: Agreement;
  let mockPurpose: Purpose;
  let mockPurposeVersion: PurposeVersion;
  let mockEServiceDescriptor: Descriptor;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    mockConsumer = {
      ...getMockTenant(),
      kind: "PA",
    };

    mockProducer = {
      ...getMockTenant(),
      kind: "PA",
    };

    mockEServiceDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 20,
    };

    mockEService = {
      ...getMockEService(),
      producerId: mockProducer.id,
      descriptors: [mockEServiceDescriptor],
    };

    mockAgreement = {
      ...getMockAgreement(),
      eserviceId: mockEService.id,
      consumerId: mockConsumer.id,
      descriptorId: mockEService.descriptors[0].id,
      state: agreementState.active,
    };

    mockPurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.waitingForApproval,
    };

    mockPurpose = {
      ...getMockPurpose(),
      riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
      consumerId: mockAgreement.consumerId,
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the activation of a purpose version in the waiting for approval state", async () => {
    vi.spyOn(pdfGenerator, "generate");

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockProducer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      versions: [purposeVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
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
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(purposeVersion.riskAnalysis!.path);

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in the waiting for approval state (With producer delegation)", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const delegate = getMockTenant();

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegatorId: mockProducer.id,
      delegateId: delegate.id,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneDelegation(producerDelegation);
    await addOneTenant(delegate);
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: delegate.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      versions: [purposeVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
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
      producerDelegationId: producerDelegation.id,
      producerDelegateName: delegate.name,
      producerDelegateIpaCode: delegate.externalId.value,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(purposeVersion.riskAnalysis!.path);

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in suspended from consumer state", async () => {
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: true,
      suspendedByProducer: false,
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockConsumer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionUnsuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionUnsuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in suspended from producer state", async () => {
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: false,
      suspendedByProducer: true,
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockProducer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionUnsuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionUnsuspendedByProducerV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in suspended from consumer state while the version daily calls are beyond the descriptor limits ", async () => {
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      dailyCalls: 9999,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: true,
      suspendedByProducer: false,
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockConsumer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionOverQuotaUnsuspended",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: purposeVersion.id,
      createdAt: new Date(),
      state: purposeVersionState.waitingForApproval,
      dailyCalls: 9999,
    };

    expect(purposeVersion).toEqual(expectedPurposeVersion);

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersionMock, expectedPurposeVersion],
      suspendedByConsumer: true,
      suspendedByProducer: false,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionOverQuotaUnsuspendedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in suspended from consumer and producer state while the version daily calls are beyond the descriptor limits ", async () => {
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      dailyCalls: 9999,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: true,
      suspendedByProducer: true,
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockConsumer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionUnsuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      suspendedByConsumer: false,
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionUnsuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in draft while the version daily calls are beyond the descriptor limits ", async () => {
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
      dailyCalls: 9999,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockConsumer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeWaitingForApproval",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeWaitingForApprovalV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the activation of a purpose version in draft", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersion = await purposeService.activatePurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      organizationId: mockConsumer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: purposeVersionMock.dailyCalls.toString(),
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
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(purposeVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeActivatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should throw organizationIsNotTheProducer if the caller is the consumer trying to activate a waiting for approval purpose version", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.waitingForApproval,
    };
    const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationIsNotTheProducer(mockConsumer.id));
  });

  it("should organizationIsNotTheConsumer if the caller is the producer trying to activate a draft purpose version", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationIsNotTheConsumer(mockProducer.id));
  });

  it("should throw tenantKindNotFound if the purpose consumer has no kind", async () => {
    const consumer = { ...mockConsumer, kind: undefined };

    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
    };

    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneAgreement(mockAgreement);
    await addOneTenant(consumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: consumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });

  it("should throw missingRiskAnalysis if the purpose has no risk analysis", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
  });

  it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });

  it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(
      agreementNotFound(mockEService.id, mockConsumer.id)
    );
  });

  it.each(
    Object.values(agreementState).filter(
      (state) => state !== agreementState.active
    )
  )(
    "should throw agreementNotFound if the caller has the agreement with state %s associated with the purpose",
    async (state) => {
      const agreement: Agreement = { ...mockAgreement, state };

      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.draft,
      };
      const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

      await addOnePurpose(purpose);
      await addOneEService(mockEService);
      await addOneAgreement(agreement);
      await addOneTenant(mockConsumer);
      await addOneTenant(mockProducer);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    }
  );

  it("should throw organizationNotAllowed if the caller is neither the producer or the consumer of the purpose, nor the delegate", async () => {
    const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);
    await addOneTenant(anotherTenant);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: anotherTenant.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationNotAllowed(anotherTenant.id));
  });

  it("should throw organizationNotAllowed if the caller is the producer but the purpose e-service has an active delegation", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationNotAllowed(mockProducer.id));
  });

  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw organizationNotAllowed if the caller is the purpose e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);
      await addOneAgreement(mockAgreement);
      await addOneTenant(mockConsumer);
      await addOneTenant(mockProducer);

      const delegate = getMockAuthData();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegate.organizationId,
        state: delegationState,
      });

      await addOneDelegation(delegation);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: delegate.organizationId,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(organizationNotAllowed(delegate.organizationId));
    }
  );

  it("should throw missingRiskAnalysis if the purpose is in draft and has no risk analysis", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(missingRiskAnalysis(purpose.id));
  });

  it("should throw riskAnalysisValidationFailed if the purpose is in draft and has an invalid risk analysis", async () => {
    const riskAnalysisForm = getMockValidRiskAnalysisForm("GSP");

    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      riskAnalysisForm,
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const result = validateRiskAnalysis(
      riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
      false,
      mockConsumer.kind as TenantKind
    );

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: purpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(
      riskAnalysisValidationFailed(
        result.type === "invalid" ? result.issues : []
      )
    );
  });

  it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockConsumer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
  });

  it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantNotFound(mockProducer.id));
  });

  it("should throw tenantKindNotFound if e-service mode is DELIVER and the tenant consumer has no kind", async () => {
    const consumer: Tenant = { ...mockConsumer, kind: undefined };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(eservice);
    await addOneAgreement(mockAgreement);
    await addOneTenant(consumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });

  it("should throw tenantKindNotFound if e-service mode is RECEIVE and the tenant producer has no kind", async () => {
    const producer: Tenant = { ...mockProducer, kind: undefined };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.receive,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(eservice);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(producer);

    expect(async () => {
      await purposeService.activatePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockProducer.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantKindNotFound(producer.id));
  });

  it.each([
    purposeVersionState.active,
    purposeVersionState.archived,
    purposeVersionState.rejected,
  ])(
    `should throw organizationNotAllowed if the purpose version is in %s state and the caller is the producer`,
    async (state) => {
      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state,
      };
      const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

      await addOnePurpose(purpose);
      await addOneEService(mockEService);
      await addOneAgreement(mockAgreement);
      await addOneTenant(mockConsumer);
      await addOneTenant(mockProducer);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          organizationId: mockProducer.id,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(organizationNotAllowed(mockProducer.id));
    }
  );

  it.each([
    purposeVersionState.active,
    purposeVersionState.archived,
    purposeVersionState.rejected,
  ])(
    `should throw organizationNotAllowed if the purpose version is in %s state and the caller is the consumer`,
    async (state) => {
      const purposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state,
      };
      const purpose: Purpose = { ...mockPurpose, versions: [purposeVersion] };

      await addOnePurpose(purpose);
      await addOneEService(mockEService);
      await addOneAgreement(mockAgreement);
      await addOneTenant(mockConsumer);
      await addOneTenant(mockProducer);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(organizationNotAllowed(mockConsumer.id));
    }
  );
});
