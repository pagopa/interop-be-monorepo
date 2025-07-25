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
  getMockDelegation,
  getMockAuthData,
  addSomeRandomDelegations,
  getMockContext,
  sortPurpose,
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
  eserviceMode,
  NewPurposeVersionActivatedV2,
  NewPurposeVersionWaitingForApprovalV2,
  delegationKind,
  delegationState,
  TenantId,
  tenantKind,
  DelegationId,
} from "pagopa-interop-models";
import { genericLogger, getIpaCode } from "pagopa-interop-commons";
import {
  agreementNotFound,
  eserviceNotFound,
  missingRiskAnalysis,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  purposeDelegationNotFound,
  purposeCannotBeUpdated,
  tenantKindNotFound,
  tenantNotFound,
  unchangedDailyCalls,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import { RiskAnalysisDocumentPDFPayload } from "../../src/model/domain/models.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  fileManager,
  pdfGenerator,
  postgresDB,
  purposeService,
} from "../integrationUtils.js";

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
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersionResponse = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 24,
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const createdPurposeVersion =
      purposeVersionResponse.data.purpose.versions.find(
        (v) => v.id === purposeVersionResponse.data.createdVersionId
      )!;

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
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(createdPurposeVersion.riskAnalysis!.path);

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
      id: createdPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: createdPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = sortPurpose({
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
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(createdPurposeVersion).toEqual(expectedPurposeVersion);
    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      toPurposeV2(expectedPurpose)
    );
    expect({
      ...purposeVersionResponse,
      data: {
        ...purposeVersionResponse.data,
        purpose: sortPurpose(purposeVersionResponse.data.purpose),
      },
    } satisfies typeof purposeVersionResponse).toMatchObject({
      data: {
        purpose: expectedPurpose,
        createdVersionId: expectedPurposeVersion.id,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 1 },
    });
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
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersionResponse = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 24,
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const createdPurposeVersion =
      purposeVersionResponse.data.purpose.versions.find(
        (v) => v.id === purposeVersionResponse.data.createdVersionId
      )!;

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
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(createdPurposeVersion.riskAnalysis!.path);

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
      id: createdPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: createdPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = sortPurpose({
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
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(createdPurposeVersion).toEqual(expectedPurposeVersion);
    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      toPurposeV2(expectedPurpose)
    );
    expect({
      ...purposeVersionResponse,
      data: {
        ...purposeVersionResponse.data,
        purpose: sortPurpose(purposeVersionResponse.data.purpose),
      },
    } satisfies typeof purposeVersionResponse).toMatchObject({
      data: {
        purpose: expectedPurpose,
        createdVersionId: expectedPurposeVersion.id,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the creation of a new purpose version (daily calls decreased and <= threshold)", async () => {
    vi.spyOn(pdfGenerator, "generate");

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersionResponse = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 4,
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const createdPurposeVersion =
      purposeVersionResponse.data.purpose.versions.find(
        (v) => v.id === purposeVersionResponse.data.createdVersionId
      )!;

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
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(createdPurposeVersion.riskAnalysis!.path);

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
      id: createdPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 4,
      riskAnalysis: createdPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = sortPurpose({
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
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(createdPurposeVersion).toEqual(expectedPurposeVersion);
    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      toPurposeV2(expectedPurpose)
    );
    expect({
      ...purposeVersionResponse,
      data: {
        ...purposeVersionResponse.data,
        purpose: sortPurpose(purposeVersionResponse.data.purpose),
      },
    } satisfies typeof purposeVersionResponse).toMatchObject({
      data: {
        purpose: expectedPurpose,
        createdVersionId: expectedPurposeVersion.id,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the creation of a new purpose version in waiting for approval state (daily calls > threshold)", async () => {
    const descriptor: Descriptor = {
      ...mockEServiceDescriptor,
      dailyCallsPerConsumer: 25,
    };
    const eservice = { ...mockEService, descriptors: [descriptor] };

    await addOnePurpose(mockPurpose);
    await addOneEService(eservice);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const purposeVersionResponse = await purposeService.createPurposeVersion(
      mockPurpose.id,
      {
        dailyCalls: 30,
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const createdPurposeVersion =
      purposeVersionResponse.data.purpose.versions.find(
        (v) => v.id === purposeVersionResponse.data.createdVersionId
      )!;

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
      id: createdPurposeVersion.id,
      createdAt: new Date(),
      state: purposeVersionState.waitingForApproval,
      dailyCalls: 30,
    };

    const expectedPurpose: Purpose = sortPurpose({
      ...mockPurpose,
      versions: [...mockPurpose.versions, expectedPurposeVersion],
      updatedAt: new Date(),
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionWaitingForApprovalV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      toPurposeV2(expectedPurpose)
    );
    expect(createdPurposeVersion).toEqual(expectedPurposeVersion);
    expect(createdPurposeVersion.state).toEqual(
      purposeVersionState.waitingForApproval
    );
    expect({
      ...purposeVersionResponse,
      data: {
        ...purposeVersionResponse.data,
        purpose: sortPurpose(purposeVersionResponse.data.purpose),
      },
    } satisfies typeof purposeVersionResponse).toMatchObject({
      data: {
        purpose: expectedPurpose,
        createdVersionId: expectedPurposeVersion.id,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 1 },
    });
  });

  it("should succeed when requester is Consumer Delegate and the creation of a new purpose version is successful", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const purpose: Purpose = {
      ...mockPurpose,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(purpose, addOneDelegation);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);
    await addOneTenant(consumerDelegate);

    const purposeVersionResponse = await purposeService.createPurposeVersion(
      purpose.id,
      {
        dailyCalls: 24,
      },
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );

    const createdPurposeVersion =
      purposeVersionResponse.data.purpose.versions.find(
        (v) => v.id === purposeVersionResponse.data.createdVersionId
      )!;

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: createdPurposeVersion.dailyCalls.toString(),
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
      consumerDelegationId: delegation.id,
      consumerDelegateName: consumerDelegate.name,
      consumerDelegateIpaCode: consumerDelegate.externalId.value,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(createdPurposeVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: createdPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: createdPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = sortPurpose({
      ...purpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(createdPurposeVersion).toEqual(expectedPurposeVersion);
    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      toPurposeV2(expectedPurpose)
    );
    expect({
      ...purposeVersionResponse,
      data: {
        ...purposeVersionResponse.data,
        purpose: sortPurpose(purposeVersionResponse.data.purpose),
      },
    } satisfies typeof purposeVersionResponse).toMatchObject({
      data: {
        purpose: expectedPurpose,
        createdVersionId: expectedPurposeVersion.id,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 1 },
    });
  });

  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the creation of a new purpose version is successful", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [mockEServiceDescriptor],
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      descriptorId: mockEServiceDescriptor.id,
      state: agreementState.active,
    };
    const delegatePurpose: Purpose = {
      ...mockPurpose,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const purposeVersionResponse = await purposeService.createPurposeVersion(
      delegatePurpose.id,
      {
        dailyCalls: 24,
      },
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );

    const createdPurposeVersion =
      purposeVersionResponse.data.purpose.versions.find(
        (v) => v.id === purposeVersionResponse.data.createdVersionId
      )!;

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: createdPurposeVersion.dailyCalls.toString(),
      answers: expect.any(String),
      eServiceName: eservice.name,
      producerName: producer.name,
      producerIpaCode: getIpaCode(producer),
      consumerName: consumer.name,
      consumerIpaCode: getIpaCode(consumer),
      freeOfCharge: expect.any(String),
      freeOfChargeReason: expect.any(String),
      date: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
      eServiceMode: "Eroga",
      producerDelegationId: producerDelegation.id,
      producerDelegateName: producerDelegate.name,
      producerDelegateIpaCode: producerDelegate.externalId.value,
      consumerDelegationId: consumerDelegation.id,
      consumerDelegateName: consumerDelegate.name,
      consumerDelegateIpaCode: consumerDelegate.externalId.value,
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/templates/documents",
        "riskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(createdPurposeVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      delegatePurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "NewPurposeVersionActivated",
      event_version: 2,
    });

    const expectedPurposeVersion: PurposeVersion = {
      id: createdPurposeVersion.id,
      createdAt: new Date(),
      firstActivationAt: new Date(),
      state: purposeVersionState.active,
      dailyCalls: 24,
      riskAnalysis: createdPurposeVersion.riskAnalysis,
    };

    const expectedPurpose: Purpose = sortPurpose({
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion,
          state: purposeVersionState.archived,
          updatedAt: new Date(),
        },
        expectedPurposeVersion,
      ],
      updatedAt: new Date(),
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: NewPurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    expect(createdPurposeVersion).toEqual(expectedPurposeVersion);
    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      toPurposeV2(expectedPurpose)
    );
    expect({
      ...purposeVersionResponse,
      data: {
        ...purposeVersionResponse.data,
        purpose: sortPurpose(purposeVersionResponse.data.purpose),
      },
    } satisfies typeof purposeVersionResponse).toMatchObject({
      data: {
        purpose: expectedPurpose,
        createdVersionId: expectedPurposeVersion.id,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 1 },
    });
  });

  it("should throw unchangedDailyCalls if the new request daily calls are the same of the previous version", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(
      async () =>
        await purposeService.createPurposeVersion(
          mockPurpose.id,
          {
            dailyCalls: mockPurposeVersion.dailyCalls,
          },
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId),
          })
        )
    ).rejects.toThrowError(unchangedDailyCalls(mockPurpose.id));
  });

  it("should throw tenantIsNotTheConsumer if the caller is the producer", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 1000,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );
    }).rejects.toThrowError(tenantIsNotTheConsumer(mockEService.producerId));
  });

  it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
    }).rejects.toThrowError(eserviceNotFound(mockEService.id));
  });

  it("should throw tenantIsNotTheConsumer if the caller is not the consumer", async () => {
    const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);
    await addOneTenant(anotherTenant);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(anotherTenant.id) })
      );
    }).rejects.toThrowError(tenantIsNotTheConsumer(anotherTenant.id));
  });

  it("should throw agreementNotFound if the caller has no agreement associated with the purpose in the read model", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
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
      await addOneEService(mockEService);
      await addOneAgreement(agreement);
      await addOneTenant(mockConsumer);
      await addOneTenant(mockProducer);

      expect(async () => {
        await purposeService.createPurposeVersion(
          mockPurpose.id,
          {
            dailyCalls: 20,
          },
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId),
          })
        );
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    }
  );

  it("should throw tenantNotFound if the purpose consumer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
    }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
  });

  it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
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
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
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
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
    }).rejects.toThrowError(tenantKindNotFound(producer.id));
  });

  it("should throw missingRiskAnalysis if there is no risk-analysis version and the passed daily calls does not surpass the descriptor limits", async () => {
    const purpose: Purpose = {
      ...mockPurpose,
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        purpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );
    }).rejects.toThrowError(missingRiskAnalysis(purpose.id));
  });
  it("should throw tenantIsNotTheDelegatedConsumer when the requester is the Consumer and is creating a purpose version for a purpose created by the delegate", async () => {
    const authData = getMockAuthData();
    const purpose = {
      ...mockPurpose,
      consumerId: authData.organizationId,
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: purpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        purpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData })
      );
    }).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(authData.organizationId, delegation.id)
    );
  });
  it("should throw purposeDelegationNotFound when the requester is the Consumer, is creating a purpose version for a purpose created by a delegate, but the delegation cannot be found", async () => {
    const authData = getMockAuthData();
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      eserviceId: mockEService.id,
      delegationId: generateId<DelegationId>(),
      consumerId: authData.organizationId,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData })
      );
    }).rejects.toThrowError(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      purposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });

  it("should throw tenantIsNotTheConsumer when the requester is a delegate for the eservice and there is no delegationId in the purpose", async () => {
    const delegatePurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockConsumer.id,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: delegatePurpose.eserviceId,
      delegatorId: delegatePurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(delegatePurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.createPurposeVersion(
        delegatePurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
    }).rejects.toThrowError(tenantIsNotTheConsumer(delegation.delegateId));
  });
  it("should throw tenantIsNotTheDelegatedConsumer if the the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate)", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    const purposeDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);
    await addOneDelegation(delegation);
    await addOneDelegation(purposeDelegation);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 20,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
    }).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(
        delegation.delegateId,
        mockPurpose.delegationId
      )
    );
  });
  it("should throw purposeCannotBeUpdated if the purpose is in archived (archived version)", async () => {
    const mockEService = getMockEService();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [getMockPurposeVersion(purposeVersionState.archived)],
    };

    await addOnePurpose(mockPurpose);

    expect(async () => {
      await purposeService.createPurposeVersion(
        mockPurpose.id,
        {
          dailyCalls: 1000,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      );
    }).rejects.toThrowError(purposeCannotBeUpdated(mockPurpose.id));
  });
});
