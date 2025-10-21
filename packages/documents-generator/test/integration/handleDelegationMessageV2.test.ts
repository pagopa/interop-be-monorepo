/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable functional/no-let */

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
} from "vitest";
import {
  DelegationEventEnvelopeV2,
  DelegationId,
  TenantId,
  EServiceId,
  generateId,
  UserId,
  delegationState,
  delegationKind,
  toDelegationV2,
  unsafeBrandId,
  CorrelationId,
} from "pagopa-interop-models";
import {
  getMockDelegation,
  getMockTenant,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  RefreshableInteropToken,
  dateAtRomeZone,
  genericLogger,
  getIpaCode,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  cleanup,
  readModelService,
  pdfGenerator,
  fileManager,
  addOneDelegation,
  addOneTenant,
  addOneEService,
} from "../integrationUtils.js";
import { handleDelegationMessageV2 } from "../../src/handler/handleDelegationMessageV2.js";
import { config } from "../../src/config/config.js";
import { tenantNotFound } from "../../src/model/errors.js";

const mockDelegationId = generateId<DelegationId>();
const mockDelegatorId = generateId<TenantId>();
const mockDelegateId = generateId<TenantId>();
const mockEServiceId = generateId<EServiceId>();
export const mockAddUnsignedDelegationContractMetadataFn = vi.fn();
vi.mock("pagopa-interop-api-clients", () => ({
  delegationApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createDelegationApiClient: () => ({
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      get addUnsignedDelegationContractMetadata() {
        return mockAddUnsignedDelegationContractMetadataFn;
      },
    }),
  },
  agreementApi: {
    createAgreementApiClient: vi.fn(),
  },
  purposeApi: {
    createPurposeApiClient: vi.fn(),
  },
}));

describe("handleDelegationMessageV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("should generate and store a contract for 'ProducerDelegationApproved' and 'ConsumerDelegationApproved' events", async () => {
    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: mockDelegatorId,
        delegateId: mockDelegateId,
        eserviceId: mockEServiceId,
        state: delegationState.active,
        stamps: {
          submission: { who: generateId(), when: new Date() },
          activation: { who: generateId(), when: new Date() },
        },
      }),
      id: mockDelegationId,
      createdAt: new Date(),
    };
    const mockDelegator = getMockTenant(mockDelegatorId);
    const mockDelegate = getMockTenant(mockDelegateId);
    const mockEService = getMockEService(mockEServiceId, mockDelegatorId, []);

    await addOneDelegation(mockDelegation);
    await addOneTenant(mockDelegator);
    await addOneTenant(mockDelegate);
    await addOneEService(mockEService);

    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegationId,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationApproved",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
      correlation_id: generateId(),
    };

    vi.spyOn(pdfGenerator, "generate").mockResolvedValue(
      Buffer.from("mock pdf content")
    );
    vi.spyOn(fileManager, "resumeOrStoreBytes").mockResolvedValue(
      `${config.s3Bucket}/${config.delegationDocumentPath}/${mockDelegationId}/mock-file.pdf`
    );
    await handleDelegationMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      genericLogger
    );

    expect(pdfGenerator.generate).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${mockDelegation.id}`,
      }),
      genericLogger
    );
  });

  it("should generate and store a contract and call delegation process", async () => {
    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: mockDelegatorId,
        delegateId: mockDelegateId,
        eserviceId: mockEServiceId,
        state: delegationState.active,
        stamps: {
          submission: { who: generateId(), when: new Date() },
          activation: { who: generateId(), when: new Date() },
        },
      }),
      id: mockDelegationId,
      createdAt: new Date(),
    };
    const mockDelegator = getMockTenant(mockDelegatorId);
    const mockDelegate = getMockTenant(mockDelegateId);
    const mockEService = getMockEService(mockEServiceId, mockDelegatorId, []);

    await addOneDelegation(mockDelegation);
    await addOneTenant(mockDelegator);
    await addOneTenant(mockDelegate);
    await addOneEService(mockEService);

    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegationId,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationApproved",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
      correlation_id: generateId(),
    };

    vi.spyOn(pdfGenerator, "generate").mockResolvedValue(
      Buffer.from("mock pdf content")
    );
    vi.spyOn(fileManager, "resumeOrStoreBytes").mockResolvedValue(
      `${config.s3Bucket}/${config.delegationDocumentPath}/${mockDelegationId}/mock-file.pdf`
    );

    testHeaders["X-Correlation-Id"] = unsafeBrandId<CorrelationId>(
      mockEvent.correlation_id!
    );

    await handleDelegationMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      genericLogger
    );

    expect(mockAddUnsignedDelegationContractMetadataFn).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/pdf",
        createdAt: expect.any(String),
        id: expect.any(String),
        name: expect.any(String),
        path: expect.any(String),
        prettyName: expect.any(String),
      }),

      expect.objectContaining({
        params: {
          delegationId: mockDelegationId,
        },
        headers: testHeaders,
      })
    );
  });

  it("should generate and store a contract for 'ProducerDelegationRevoked' and 'ConsumerDelegationRevoked' events", async () => {
    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: mockDelegatorId,
        delegateId: mockDelegateId,
        eserviceId: mockEServiceId,
        state: delegationState.revoked,
        stamps: {
          submission: { who: generateId(), when: new Date() },
          revocation: { who: generateId(), when: new Date() },
        },
      }),
      id: mockDelegationId,
      createdAt: new Date(),
      revocationAt: new Date(),
      revokedBy: generateId<UserId>(),
    };

    const mockDelegator = getMockTenant(mockDelegatorId);
    const mockDelegate = getMockTenant(mockDelegateId);
    const mockEService = getMockEService(mockEServiceId, mockDelegatorId, []);

    await addOneDelegation(mockDelegation);
    await addOneTenant(mockDelegator);
    await addOneTenant(mockDelegate);
    await addOneEService(mockEService);

    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegationId,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationRevoked",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    vi.spyOn(pdfGenerator, "generate").mockResolvedValue(
      Buffer.from("mock pdf content")
    );
    vi.spyOn(fileManager, "resumeOrStoreBytes").mockResolvedValue(
      `${config.s3Bucket}/${config.delegationDocumentPath}/${mockDelegationId}/mock-file.pdf`
    );

    await handleDelegationMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      genericLogger
    );

    expect(pdfGenerator.generate).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${mockDelegation.id}`,
      }),
      genericLogger
    );
  });

  it("should generate and store a contract for 'ProducerDelegationRevoked' and 'ConsumerDelegationRevoked' events", async () => {
    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: mockDelegatorId,
        delegateId: mockDelegateId,
        eserviceId: mockEServiceId,
        state: delegationState.revoked,
        stamps: {
          submission: { who: generateId(), when: new Date() },
          revocation: { who: generateId(), when: new Date() },
        },
      }),
      id: mockDelegationId,
      createdAt: new Date(),
      revocationAt: new Date(),
      revokedBy: generateId<UserId>(),
    };

    const mockDelegator = getMockTenant(mockDelegatorId);
    const mockDelegate = getMockTenant(mockDelegateId);
    const mockEService = getMockEService(mockEServiceId, mockDelegatorId, []);

    await addOneDelegation(mockDelegation);
    await addOneTenant(mockDelegator);
    await addOneTenant(mockDelegate);
    await addOneEService(mockEService);

    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegationId,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationRevoked",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    vi.spyOn(pdfGenerator, "generate").mockResolvedValue(
      Buffer.from("mock pdf content")
    );
    vi.spyOn(fileManager, "resumeOrStoreBytes").mockResolvedValue(
      `${config.s3Bucket}/${config.delegationDocumentPath}/${mockDelegationId}/mock-file.pdf`
    );

    await handleDelegationMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      genericLogger
    );

    expect(pdfGenerator.generate).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${mockDelegation.id}`,
      }),
      genericLogger
    );
  });

  it("should generate the correct activation contract payload for 'ProducerDelegationApproved'", async () => {
    const mockActivatorId = generateId<UserId>();
    const mockSubmissionWho = generateId<UserId>();
    const mockSubmissionWhen = new Date(Date.now() - 50000);
    const mockActivationWhen = new Date(Date.now() - 10000);

    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: mockDelegatorId,
        delegateId: mockDelegateId,
        eserviceId: mockEServiceId,
        state: delegationState.active,
        stamps: {
          submission: { who: mockSubmissionWho, when: mockSubmissionWhen },
          activation: { who: mockActivatorId, when: mockActivationWhen },
        },
      }),
      id: mockDelegationId,
    };

    const mockDelegator = {
      ...getMockTenant(mockDelegatorId),
      name: "Delegator S.P.A.",
      externalId: { origin: "IPA", value: "DELEGATORIPACODE" },
    };
    const mockDelegate = {
      ...getMockTenant(mockDelegateId),
      name: "Delegate S.R.L.",
      externalId: { origin: "IPA", value: "DELEGATEIPACODE" },
    };
    const mockEService = {
      ...getMockEService(mockEServiceId, mockDelegatorId, []),
      name: "E-Service Fantastico",
    };

    await addOneDelegation(mockDelegation);
    await addOneTenant(mockDelegator);
    await addOneTenant(mockDelegate);
    await addOneEService(mockEService);

    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegationId,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationApproved",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    const generateSpy = vi
      .spyOn(pdfGenerator, "generate")
      .mockResolvedValue(Buffer.from("mock pdf content"));

    await handleDelegationMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      genericLogger
    );

    const submissionDate = dateAtRomeZone(
      mockDelegation.stamps.submission.when
    );
    const submissionTime = timeAtRomeZone(
      mockDelegation.stamps.submission.when
    );
    const activationDate = dateAtRomeZone(
      mockDelegation.stamps.activation!.when
    );
    const activationTime = timeAtRomeZone(
      mockDelegation.stamps.activation!.when
    );

    const expectedPayload = {
      delegationKindText: "all’erogazione",
      delegationActionText: "ad erogare l’",
      todayDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
      todayTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
      delegationId: mockDelegation.id,
      delegatorName: mockDelegator.name,
      delegatorIpaCode: getIpaCode(mockDelegator),
      delegateName: mockDelegate.name,
      delegateIpaCode: getIpaCode(mockDelegate),
      eserviceId: mockEService.id,
      eserviceName: mockEService.name,
      submitterId: mockDelegation.stamps.submission.who,
      submissionDate,
      submissionTime,
      activatorId: mockDelegation.stamps.activation!.who,
      activationDate,
      activationTime,
    };

    expect(generateSpy).toHaveBeenCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src/",
        "resources/delegation/",
        "delegationApprovedTemplate.html"
      ),
      expectedPayload
    );
  });

  it("should not process events that don't require contract generation", async () => {
    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      delegatorId: mockDelegatorId,
      delegateId: mockDelegateId,
      eserviceId: mockEServiceId,
      state: delegationState.active,
      stamps: {
        submission: { who: generateId(), when: new Date() },
        activation: { who: generateId(), when: new Date() },
      },
    });
    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 1,
      event_version: 2,
      type: "ConsumerDelegationRejected",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };
    const pdfGeneratorSpy = vi.spyOn(pdfGenerator, "generate");
    const fileManagerSpy = vi.spyOn(fileManager, "resumeOrStoreBytes");

    await expect(
      handleDelegationMessageV2(
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

  it("should throw an error if one of the required entities (delegator, delegate, or e-service) is not found", async () => {
    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: mockDelegatorId,
        delegateId: mockDelegateId,
        eserviceId: mockEServiceId,
        state: delegationState.active,
      }),
      id: mockDelegationId,
    };
    await addOneDelegation(mockDelegation);
    // Omitting the delegate to force throwin error
    await addOneTenant(getMockTenant(mockDelegatorId));
    await addOneEService(getMockEService(mockEServiceId, mockDelegatorId, []));

    const mockEvent: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegationId,
      version: 1,
      event_version: 2,
      type: "ProducerDelegationApproved",
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    await expect(
      handleDelegationMessageV2(
        mockEvent,
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        genericLogger
      )
    ).rejects.toThrow(tenantNotFound(mockDelegateId).message);
  });
});
