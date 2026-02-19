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
  addSomeRandomDelegations,
  getMockContext,
  sortPurpose,
  getMockPurposeTemplate,
  getMockExpiredRiskAnalysisForm,
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
  tenantKind,
  TenantId,
  DelegationId,
  UserId,
  purposeTemplateState,
  PurposeTemplate,
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
  riskAnalysisValidationFailed,
  tenantNotFound,
  agreementNotFound,
  tenantIsNotTheProducer,
  tenantIsNotTheConsumer,
  tenantNotAllowed,
  tenantIsNotTheDelegatedConsumer,
  tenantIsNotTheDelegate,
  purposeTemplateNotFound,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import { RiskAnalysisDocumentPDFPayload } from "../../src/model/domain/models.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOnePurposeTemplate,
  addOneTenant,
  fileManager,
  pdfGenerator,
  postgresDB,
  purposeService,
} from "../integrationUtils.js";

describe("activatePurposeVersion", () => {
  const userId: UserId = generateId();

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

    const consumerUserId = generateId<UserId>();
    const versionWithStamp: PurposeVersion = {
      ...mockPurposeVersion,
      stamps: {
        creation: {
          who: consumerUserId,
          when: new Date(),
        },
      },
    };
    const purposeWithStamp: Purpose = {
      ...mockPurpose,
      versions: [versionWithStamp],
      consumerId: mockConsumer.id,
    };
    await addOnePurpose(purposeWithStamp);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purposeWithStamp.id,
        versionId: versionWithStamp.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockProducer.id, userId) })
    );

    const updatedVersion = activateResponse.data;

    const writtenEvent = await readLastEventByStreamId(
      purposeWithStamp.id,
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
      ...purposeWithStamp,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      versions: [updatedVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionActivatedV2,
      payload: writtenEvent.data,
    });

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: versionWithStamp.dailyCalls.toString(),
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
      userId: consumerUserId,
      consumerId: purposeWithStamp.consumerId,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the activation of a purpose version in the waiting for approval state (With producer delegation)", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const delegate: Tenant = { ...getMockTenant(), kind: "PA" };

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

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: producerDelegation.id,
      },
      getMockContext({ authData: getMockAuthData(delegate.id, userId) })
    );

    const updatedVersion = activateResponse.data;

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
      versions: [updatedVersion],
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
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
      userId: undefined,
      consumerId: mockPurpose.consumerId,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the activation of a purpose version in suspended from consumer state", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: true,
      suspendedByProducer: false,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id) })
    );

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "PurposeVersionUnsuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      versions: [
        {
          ...purposeVersion,
          state: purposeVersionState.active,
          suspendedAt: undefined,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionUnsuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the activation of a purpose version in suspended from producer state", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: false,
      suspendedByProducer: true,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockProducer.id) })
    );

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "PurposeVersionUnsuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      versions: [
        {
          ...purposeVersion,
          state: purposeVersionState.active,
          suspendedAt: undefined,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionUnsuspendedByProducerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the activation of a purpose version in suspended from consumer state while the version daily calls are beyond the descriptor limits ", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.suspended,
      dailyCalls: 9999,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      suspendedByConsumer: true,
      suspendedByProducer: false,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id) })
    );

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "PurposeVersionOverQuotaUnsuspended",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      versions: [
        purposeVersion,
        {
          id: activateResponse.data.id,
          dailyCalls: purposeVersion.dailyCalls,
          createdAt: purposeVersion.createdAt,
          state: purposeVersionState.waitingForApproval,
        },
      ],
      suspendedByConsumer: true,
      suspendedByProducer: false,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionOverQuotaUnsuspendedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );

    expect(activateResponse).toMatchObject({
      data: expectedPurpose.versions[1],
      metadata: { version: 1 },
    });
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

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purpose.id,
        versionId: purposeVersionMock.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id) })
    );

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "PurposeVersionUnsuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      versions: [
        {
          ...purposeVersionMock,
          state: purposeVersionState.suspended,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionUnsuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });
  });

  it("should write on event-store for the activation of a purpose version in draft while the version daily calls are beyond the descriptor limits ", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
      dailyCalls: 9999,
      suspendedAt: new Date(),
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
    };

    await addOnePurpose(purpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purpose.id,
        versionId: purposeVersion.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id) })
    );

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "PurposeWaitingForApproval",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      versions: [
        { ...purposeVersion, state: purposeVersionState.waitingForApproval },
      ],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeWaitingForApprovalV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });
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

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id, userId) })
    );

    const updatedVersion = activateResponse.data;

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
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
      userId,
      consumerId: mockPurpose.consumerId,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

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
      versions: [updatedVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeActivatedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });

  it("should succeed when requester is Consumer Delegate and the purpose version in draft state is activated correctly", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersionMock],
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

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: purpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: delegation.id,
      },
      getMockContext({
        authData: getMockAuthData(delegation.delegateId, userId),
      })
    );

    const updatedVersion = activateResponse.data;

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
      consumerDelegationId: delegation.id,
      consumerDelegateName: consumerDelegate.name,
      consumerDelegateIpaCode: consumerDelegate.externalId.value,
      userId,
      consumerId: mockPurpose.consumerId,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      purpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "PurposeActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      versions: [updatedVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeActivatedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });
  it("should succeed when risk analysis is expired and the purpose version in draft state is activated correctly", async () => {
    vi.spyOn(pdfGenerator, "generate");
    const eservice = {
      ...mockEService,
      mode: eserviceMode.receive,
    };
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      riskAnalysisForm: getMockExpiredRiskAnalysisForm(tenantKind.PA),
      versions: [purposeVersionMock],
    };

    await addOnePurpose(purpose);
    await addOneEService(eservice);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockConsumer.id, userId) })
    );

    const updatedVersion = activateResponse.data;

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: purposeVersionMock.dailyCalls.toString(),
      answers: expect.any(String),
      eServiceName: eservice.name,
      producerName: mockProducer.name,
      producerIpaCode: getIpaCode(mockProducer),
      consumerName: mockConsumer.name,
      consumerIpaCode: getIpaCode(mockConsumer),
      freeOfCharge: expect.any(String),
      freeOfChargeReason: expect.any(String),
      date: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
      eServiceMode: "Riceve",
      producerDelegationId: undefined,
      producerDelegateName: undefined,
      producerDelegateIpaCode: undefined,
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
      userId,
      consumerId: mockPurpose.consumerId,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

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
      ...purpose,
      versions: [updatedVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeActivatedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the purpose version in draft state is activated correctly", async () => {
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
      mode: eserviceMode.deliver,
      producerId: producer.id,
      descriptors: [mockEServiceDescriptor],
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
      descriptorId: mockEServiceDescriptor.id,
    };

    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };

    const delegatePurpose: Purpose = {
      ...mockPurpose,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [purposeVersionMock],
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

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: consumerDelegation.id,
      },
      getMockContext({
        authData: getMockAuthData(consumerDelegate.id, userId),
      })
    );

    const updatedVersion = activateResponse.data;

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: purposeVersionMock.dailyCalls.toString(),
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
      userId,
      consumerId: consumer.id,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      delegatePurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "PurposeActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [updatedVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeActivatedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });

  it("should succeed when requester is Consumer Delegate and also the producer of the eservice and the purpose version in draft state is activated correctly", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      producerId: producer.id,
      descriptors: [mockEServiceDescriptor],
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
      descriptorId: mockEServiceDescriptor.id,
    };

    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };

    const delegatePurpose: Purpose = {
      ...mockPurpose,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [purposeVersionMock],
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: producer.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const activateResponse = await purposeService.activatePurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        delegationId: consumerDelegation.id,
      },
      getMockContext({ authData: getMockAuthData(producer.id, userId) })
    );

    const updatedVersion = activateResponse.data;

    const expectedPdfPayload: RiskAnalysisDocumentPDFPayload = {
      dailyCalls: purposeVersionMock.dailyCalls.toString(),
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
      producerDelegationId: undefined,
      producerDelegateName: undefined,
      producerDelegateIpaCode: undefined,
      consumerDelegationId: consumerDelegation.id,
      consumerDelegateName: producer.name,
      consumerDelegateIpaCode: producer.externalId.value,
      userId,
      consumerId: consumer.id,
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
    ).toContain(updatedVersion.riskAnalysis!.path);

    const writtenEvent = await readLastEventByStreamId(
      delegatePurpose.id,
      "purpose",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "PurposeActivated",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [updatedVersion],
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeActivatedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(activateResponse).toMatchObject({
      data: updatedVersion,
      metadata: { version: 1 },
    });
  });

  it("should throw tenantIsNotTheProducer if the caller is the consumer trying to activate a waiting for approval purpose version", async () => {
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
    }).rejects.toThrowError(tenantIsNotTheProducer(mockConsumer.id));
  });

  it("should tenantIsNotTheConsumer if the caller is the producer trying to activate a draft purpose version", async () => {
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      );
    }).rejects.toThrowError(tenantIsNotTheConsumer(mockProducer.id));
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(consumer.id) })
      );
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
    }).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
  });

  it("should throw eserviceNotFound if the e-service does not exists in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
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
        await purposeService.activatePurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            delegationId: undefined,
          },
          getMockContext({ authData: getMockAuthData(mockConsumer.id) })
        );
      }).rejects.toThrowError(
        agreementNotFound(mockEService.id, mockConsumer.id)
      );
    }
  );

  it("should throw tenantNotAllowed if the caller is neither the producer or the consumer of the purpose, nor the delegate", async () => {
    const anotherTenant: Tenant = { ...getMockTenant(), kind: "PA" };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);
    await addOneTenant(anotherTenant);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(anotherTenant.id) })
      );
    }).rejects.toThrowError(tenantNotAllowed(anotherTenant.id));
  });

  it("should throw tenantIsNotTheDelegate if the caller is the producer but the purpose e-service has an active delegation", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const delegation = getMockDelegation({
      delegatorId: mockProducer.id,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      );
    }).rejects.toThrowError(tenantIsNotTheDelegate(mockProducer.id));
  });

  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw tenantIsNotTheDelegate if the caller is the purpose e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);
      await addOneAgreement(mockAgreement);
      await addOneTenant(mockConsumer);
      await addOneTenant(mockProducer);

      const delegation = getMockDelegation({
        delegatorId: mockEService.producerId,
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        state: delegationState,
      });

      await addOneDelegation(delegation);

      expect(async () => {
        await purposeService.activatePurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            delegationId: delegation.id,
          },
          getMockContext({ authData: getMockAuthData(delegation.delegateId) })
        );
      }).rejects.toThrowError(tenantIsNotTheDelegate(delegation.delegateId));
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
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
      mockConsumer.kind as TenantKind,
      new Date(),
      undefined
    );

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
    }).rejects.toThrowError(tenantNotFound(mockConsumer.id));
  });

  it("should throw tenantNotFound if the purpose producer is not found in the readmodel", async () => {
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
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
      await purposeService.activatePurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockProducer.id) })
      );
    }).rejects.toThrowError(tenantKindNotFound(consumer.id));
  });
  it.each([
    purposeVersionState.active,
    purposeVersionState.archived,
    purposeVersionState.rejected,
  ])(
    `should throw tenantNotAllowed if the purpose version is in %s state and the caller is the producer`,
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
        await purposeService.activatePurposeVersion(
          {
            purposeId: purpose.id,
            versionId: purposeVersion.id,
            delegationId: undefined,
          },
          getMockContext({ authData: getMockAuthData(mockProducer.id) })
        );
      }).rejects.toThrowError(tenantNotAllowed(mockProducer.id));
    }
  );

  it.each([
    purposeVersionState.active,
    purposeVersionState.archived,
    purposeVersionState.rejected,
  ])(
    `should throw tenantNotAllowed if the purpose version is in %s state and the caller is the consumer`,
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
        await purposeService.activatePurposeVersion(
          {
            purposeId: purpose.id,
            versionId: purposeVersion.id,
            delegationId: undefined,
          },
          getMockContext({ authData: getMockAuthData(mockConsumer.id) })
        );
      }).rejects.toThrowError(tenantNotAllowed(mockConsumer.id));
    }
  );

  it(`should throw tenantIsNotTheDelegatedConsumer when the requester is the Consumer but there is a Consumer Delegation`, async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      delegationId: generateId<DelegationId>(),
      consumerId: mockConsumer.id,
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
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);
    await addOneDelegation(delegation);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: purposeVersion.id,
          delegationId: delegation.id,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
    }).rejects.toThrowError(
      tenantIsNotTheDelegatedConsumer(mockConsumer.id, delegation.id)
    );
  });

  it("should throw tenantIsNotTheDelegate if the requester is a delegate for the purpose but there is no delegationId in the purpose", async () => {
    const purposeVersion: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersion],
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(purpose, addOneDelegation);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: delegation.id,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
    }).rejects.toThrowError(tenantIsNotTheDelegate(delegation.delegateId));
  });

  it("should throw tenantIsNotTheDelegate if the the requester is a delegate for the purpose but there is a delegationId in purpose but for a different delegationId (a different delegate)", async () => {
    const purposeVersionMock: PurposeVersion = {
      ...mockPurposeVersion,
      state: purposeVersionState.draft,
    };
    const purpose: Purpose = {
      ...mockPurpose,
      versions: [purposeVersionMock],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: generateId<DelegationId>(),
      kind: delegationKind.delegatedConsumer,
      eserviceId: purpose.eserviceId,
      delegatorId: purpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(purpose);
    await addOneDelegation(delegation);
    await addOneDelegation(
      getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        id: purpose.delegationId,
        state: delegationState.active,
      })
    );
    await addSomeRandomDelegations(purpose, addOneDelegation);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: delegation.id,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
    }).rejects.toThrowError(tenantIsNotTheDelegate(delegation.delegateId));
  });
  it("should throw purposeTemplateNotFound if the purpose was created from a purpose template but the template is not active", async () => {
    const mockPurposeTemplate: PurposeTemplate = getMockPurposeTemplate(
      mockConsumer.id,
      purposeTemplateState.draft
    );

    const purpose: Purpose = {
      ...mockPurpose,
      purposeTemplateId: mockPurposeTemplate.id,
    };

    await addOneTenant(mockConsumer);
    await addOnePurpose(purpose);
    await addOnePurposeTemplate(mockPurposeTemplate);
    await addOneEService(mockEService);
    await addOneAgreement(mockAgreement);

    expect(async () => {
      await purposeService.activatePurposeVersion(
        {
          purposeId: purpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockConsumer.id) })
      );
    }).rejects.toThrowError(
      purposeTemplateNotFound(purpose.purposeTemplateId!)
    );
  });
});
