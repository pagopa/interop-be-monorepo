/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import path from "path";
import { fileURLToPath } from "url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  readLastEventByStreamId,
  decodeProtobufPayload,
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockPurposeVersion,
  getMockPurpose,
  getMockValidRiskAnalysisForm,
  writeInReadmodel,
  getMockDelegation,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  generateId,
  toPurposeV2,
  Tenant,
  Descriptor,
  EService,
  Agreement,
  agreementState,
  PurposeVersion,
  toReadModelEService,
  eserviceMode,
  toReadModelAgreement,
  NewPurposeVersionActivatedV2,
  NewPurposeVersionWaitingForApprovalV2,
  toReadModelTenant,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { genericLogger, getIpaCode } from "pagopa-interop-commons";
import {
  agreementNotFound,
  eserviceNotFound,
  missingRiskAnalysis,
  organizationIsNotTheConsumer,
  organizationNotAllowed,
  tenantKindNotFound,
  tenantNotFound,
  unchangedDailyCalls,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import { RiskAnalysisDocumentPDFPayload } from "../src/model/domain/models.js";
import {
  addOneDelegation,
  addOneTenant,
  agreements,
  eservices,
  fileManager,
  pdfGenerator,
  postgresDB,
  purposeService,
  tenants,
} from "./utils.js";
import { addOnePurpose } from "./utils.js";

describe("createPurposeVersion", () => {
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
      dailyCallsPerConsumer: 25,
      dailyCallsTotal: 50,
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
      state: purposeVersionState.active,
      dailyCalls: 5,
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

  it("should write on event-store for the creation of a new purpose version (daily calls increased and <= threshold)", async () => {
    vi.spyOn(pdfGenerator, "generate");

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion({
      purposeId: mockPurpose.id,
      seed: {
        dailyCalls: 24,
      },
      organizationId: mockPurpose.consumerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: "24",
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
    ).toContain(returnedPurposeVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the creation of a new purpose version (daily calls increased and <= threshold) (with producer delegation)", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const delegate = getMockTenant();

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegatorId: mockProducer.id,
      delegateId: delegate.id,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(producerDelegation);
    await addOneTenant(delegate);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion({
      purposeId: mockPurpose.id,
      seed: {
        dailyCalls: 24,
      },
      organizationId: mockPurpose.consumerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: "24",
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
    ).toContain(returnedPurposeVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the creation of a new purpose version (daily calls decreased and <= threshold)", async () => {
    vi.spyOn(pdfGenerator, "generate");

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion({
      purposeId: mockPurpose.id,
      seed: {
        dailyCalls: 4,
      },
      organizationId: mockPurpose.consumerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: "4",
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
    ).toContain(returnedPurposeVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      mockPurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 4,
      riskAnalysis: returnedPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
  });

  it("should write on event-store for the creation of a new purpose version in waiting for approval state (daily calls > threshold)", async () => {
    const descriptor: Descriptor = {
      ...mockEServiceDescriptor,
      dailyCallsPerConsumer: 25,
    };
    const eservice = { ...mockEService, descriptors: [descriptor] };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    const returnedPurposeVersion = await purposeService.createPurposeVersion({
      purposeId: mockPurpose.id,
      seed: {
        dailyCalls: 30,
      },
      organizationId: mockPurpose.consumerId,
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
      type: "NewPurposeVersionWaitingForApproval",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: returnedPurposeVersion.id,
      createdAt: new Date(),
      state: purposeVersionState.waitingForApproval,
      dailyCalls: 30,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [...mockPurpose.versions, expectedPurposeVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionWaitingForApprovalV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(returnedPurposeVersion).toEqual(expectedPurposeVersion);
    expect(returnedPurposeVersion.state).toEqual(
      purposeVersionState.waitingForApproval
    );
  });

  it("should throw unchangedDailyCalls if the new request daily calls are the same of the previous version", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(
      async () =>
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: mockPurposeVersion.dailyCalls,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
    ).rejects.toThrowError(unchangedDailyCalls(mockPurpose.id));
  });

  it("should throw organizationIsNotTheConsumer if the caller is not the consumer", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 1000,
        },
        organizationId: mockEService.producerId,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(
      organizationIsNotTheConsumer(mockEService.producerId)
    );
  });

  it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });

  it("should throw organizationNotAllowed if the caller is neither the producer or the consumer of the purpose", async () => {
    const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);
    await writeInReadmodel(toReadModelTenant(anotherTenant), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: anotherTenant.id,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(organizationNotAllowed(anotherTenant.id));
  });

  it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(
      agreementNotFound(mockEService.id, mockConsumer.id)
    );
  });

  it.each([
    agreementState.archived,
    agreementState.draft,
    agreementState.missingCertifiedAttributes,
    agreementState.pending,
    agreementState.rejected,
    agreementState.suspended,
  ])(
    "should throw agreementNotFound if the caller has the agreement with state %s associated with the purpose",
    async (state) => {
      const agreement: Agreement = { ...mockAgreement, state };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(toReadModelAgreement(agreement), agreements);
      await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
      await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 20,
          },
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        });
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    }
  );

  it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
  });

  it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
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
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(consumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
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
    await writeInReadmodel(toReadModelEService(eservice), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(producer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(tenantKindNotFound(producer.id));
  });

  it("should throw missingRiskAnalysis if there is no risk-analysis version and the passed daily calls does not surpass the descriptor limits", async () => {
    const purpose: Purpose = {
      ...mockPurpose,
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);
    await writeInReadmodel(toReadModelTenant(mockConsumer), tenants);
    await writeInReadmodel(toReadModelTenant(mockProducer), tenants);

    expect(async () => {
      await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });
    }).rejects.toThrowError(missingRiskAnalysis(purpose.id));
  });
});
