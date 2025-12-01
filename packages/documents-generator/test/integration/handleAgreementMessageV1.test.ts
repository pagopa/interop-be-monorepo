/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */

import path from "path";
import { fileURLToPath } from "url";
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import {
  AgreementEventEnvelopeV1,
  AgreementId,
  EServiceId,
  TenantId,
  generateId,
  UserId,
  descriptorState,
  DescriptorId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
  AttributeId,
  Agreement,
  Attribute,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  delegationKind,
  delegationState,
  CorrelationId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  RefreshableInteropToken,
  dateAtRomeZone,
  genericLogger,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  toAgreementV1,
} from "pagopa-interop-commons-test";
import { addDays } from "date-fns";
import {
  cleanup,
  readModelService,
  pdfGenerator,
  fileManager,
  addOneEService,
  addOneTenant,
  addOneAgreement,
  addOneAttribute,
} from "../integrationUtils.js";
import { handleAgreementMessageV1 } from "../../src/handler/handleAgreementMessageV1.js";
import { config } from "../../src/config/config.js";
import { eServiceNotFound, tenantNotFound } from "../../src/model/errors.js";
import { getInteropBeClients } from "../../src/clients/clientProvider.js";

const mockAgreementId = generateId<AgreementId>();
const mockEServiceId = generateId<EServiceId>();
const mockProducerId = generateId<TenantId>();
const mockConsumerId = generateId<TenantId>();
const clients = getInteropBeClients();
export const mockAddUnsignedAgreementContractMetadataFn = vi.fn();
vi.mock("pagopa-interop-api-clients", () => ({
  delegationApi: {
    createDelegationApiClient: vi.fn(),
  },
  agreementApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createAgreementApiClient: () => ({
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      get addUnsignedAgreementContractMetadata() {
        return mockAddUnsignedAgreementContractMetadataFn;
      },
    }),
  },
  purposeApi: {
    createPurposeApiClient: vi.fn(),
  },
}));

describe("handleAgreementMessageV1", () => {
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
  const currentExecutionTime = new Date();

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

  it("should generate and store a contract for an 'AgreementActivated' event", async () => {
    const mockDescriptorId = generateId<DescriptorId>();
    const mockAgreement = {
      ...getMockAgreement(mockEServiceId, mockConsumerId, "Active"),
      producerId: mockProducerId,
      id: mockAgreementId,
      descriptorId: mockDescriptorId,
      stamps: {
        submission: {
          who: generateId<UserId>(),
          when: new Date(),
        },
        activation: {
          who: generateId<UserId>(),
          when: new Date(),
        },
      },
    };
    const descriptor = {
      ...getMockDescriptorPublished(),
      id: mockDescriptorId,
      state: descriptorState.suspended,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    const mockEService = {
      ...getMockEService(mockEServiceId, mockProducerId, [descriptor]),
    };
    const mockConsumer = {
      ...getMockTenant(mockConsumerId),
    };
    const mockProducer = {
      ...getMockTenant(mockProducerId),
    };
    await addOneAgreement(mockAgreement);
    await addOneEService(mockEService);
    await addOneTenant(mockConsumer);
    await addOneTenant(mockProducer);

    const mockEvent: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockAgreementId,
      version: 1,
      event_version: 1,
      type: "AgreementActivated",
      data: { agreement: toAgreementV1(mockAgreement) },
      log_date: new Date(),
    };

    vi.spyOn(pdfGenerator, "generate").mockResolvedValue(
      Buffer.from("mock pdf content")
    );
    vi.spyOn(fileManager, "resumeOrStoreBytes").mockResolvedValue(
      `${config.s3Bucket}/${config.agreementContractsPath}/${mockAgreementId}/mock-file.pdf`
    );

    await handleAgreementMessageV1(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      clients,
      genericLogger
    );

    expect(pdfGenerator.generate).toHaveBeenCalledOnce();
    expect(fileManager.resumeOrStoreBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: config.s3Bucket,
        path: `${config.agreementContractsPath}/${mockAgreement.id}`,
      }),
      genericLogger
    );
  });

  it("should generate and store a contract for an 'AgreementActivated' event with detailed payload check and call agreement process", async () => {
    const mockAttributeIdCertified = generateId<AttributeId>();
    const mockAttributeIdDeclared = generateId<AttributeId>();
    const mockAttributeIdVerified = generateId<AttributeId>();
    const mockActivatorId = generateId<UserId>();

    const mockProducer: Tenant = getMockTenant();
    const consumerId: TenantId = generateId();

    const certifiedAttribute: Attribute = {
      ...getMockAttribute("Certified", mockAttributeIdCertified),
      kind: "Certified",
    };

    const declaredAttribute: Attribute = {
      ...getMockAttribute("Declared", mockAttributeIdDeclared),
      kind: "Declared",
    };

    const verifiedAttribute: Attribute = {
      ...getMockAttribute("Verified", mockAttributeIdVerified),
      kind: "Verified",
    };

    const mockCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
      revocationTimestamp: undefined,
    };

    const mockTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(declaredAttribute.id),
      revocationTimestamp: undefined,
    };

    const mockTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
      verifiedBy: [
        {
          id: mockProducer.id,
          verificationDate: new Date(),
          expirationDate: addDays(new Date(), 40),
          extensionDate: addDays(new Date(), 30),
        },
      ],
      revokedBy: [],
    };

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: "Published",
      attributes: {
        certified: [[getMockEServiceAttribute(mockCertifiedAttribute.id)]],
        declared: [[getMockEServiceAttribute(mockTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(mockTenantVerifiedAttribute.id)]],
      },
    };

    const mockEService: EService = {
      ...getMockEService(),
      producerId: mockProducer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      eserviceId: mockEService.id,
      descriptorId: descriptor.id,
      producerId: mockProducer.id,
      consumerId,
      suspendedByConsumer: false,
      suspendedByProducer: false,
      stamps: {
        submission: {
          who: generateId(),
          when: new Date(),
        },
        activation: {
          who: mockActivatorId,
          when: new Date(),
        },
      },

      certifiedAttributes: [getMockAgreementAttribute(certifiedAttribute.id)],
      declaredAttributes: [getMockAgreementAttribute(declaredAttribute.id)],
      verifiedAttributes: [getMockAgreementAttribute(verifiedAttribute.id)],
    };

    const delegateConsumer = getMockTenant();
    const consumerDelegation = delegateConsumer
      ? getMockDelegation({
          kind: delegationKind.delegatedConsumer,
          delegatorId: mockAgreement.consumerId,
          delegateId: delegateConsumer.id,
          state: delegationState.active,
          eserviceId: mockAgreement.eserviceId,
        })
      : undefined;

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(mockCertifiedAttribute.id),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(mockTenantDeclaredAttribute.id),
      revocationTimestamp: undefined,
      delegationId: consumerDelegation?.id,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(mockTenantVerifiedAttribute.id),
      verifiedBy: [
        {
          id: mockProducer.id,
          verificationDate: new Date(),
          expirationDate: new Date(),
        },
      ],
      revokedBy: [],
    };

    const mockConsumer: Tenant = {
      ...getMockTenant(consumerId),
      selfcareId: generateId(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    await addOneAgreement(mockAgreement);
    await addOneTenant(mockProducer);
    await addOneTenant(mockConsumer);
    await addOneEService(mockEService);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(declaredAttribute);
    await addOneAttribute(verifiedAttribute);
    vi.spyOn(pdfGenerator, "generate").mockResolvedValue(
      Buffer.from("mock pdf content")
    );
    vi.spyOn(fileManager, "resumeOrStoreBytes").mockResolvedValue(`mock/path`);

    const mockEvent: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockAgreementId,
      version: 1,
      event_version: 1,
      type: "AgreementActivated",
      data: { agreement: toAgreementV1(mockAgreement) },
      log_date: new Date(),
      correlation_id: generateId(),
    };

    testHeaders["X-Correlation-Id"] = unsafeBrandId<CorrelationId>(
      mockEvent.correlation_id!
    );

    await handleAgreementMessageV1(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      clients,
      genericLogger
    );
    const expectedPayload = {
      todayDate: dateAtRomeZone(currentExecutionTime),
      todayTime: timeAtRomeZone(currentExecutionTime),
      agreementId: mockAgreement.id,
      submitterId: mockAgreement.stamps.submission!.who,
      submissionDate: dateAtRomeZone(mockAgreement.stamps.submission!.when),
      submissionTime: timeAtRomeZone(mockAgreement.stamps.submission!.when),
      activatorId: mockActivatorId,
      activationDate: dateAtRomeZone(mockAgreement.stamps.activation!.when),
      activationTime: timeAtRomeZone(mockAgreement.stamps.activation!.when),
      eserviceId: mockEService.id,
      eserviceName: mockEService.name,
      descriptorId: mockEService.descriptors[0].id,
      descriptorVersion: descriptor.version,
      producerName: mockProducer.name,
      producerIpaCode: mockProducer.externalId.value,
      consumerName: mockConsumer.name,
      consumerIpaCode: mockConsumer.externalId.value,

      certifiedAttributes: [
        {
          assignmentDate: dateAtRomeZone(
            validTenantCertifiedAttribute.assignmentTimestamp
          ),
          assignmentTime: timeAtRomeZone(
            validTenantCertifiedAttribute.assignmentTimestamp
          ),
          attributeName: certifiedAttribute.name,
          attributeId: mockCertifiedAttribute.id,
        },
      ],
      declaredAttributes: [
        {
          assignmentDate: dateAtRomeZone(
            validTenantDeclaredAttribute.assignmentTimestamp
          ),
          assignmentTime: timeAtRomeZone(
            validTenantDeclaredAttribute.assignmentTimestamp
          ),
          attributeName: declaredAttribute.name,
          attributeId: mockTenantDeclaredAttribute.id,
          delegationId: validTenantDeclaredAttribute.delegationId,
        },
      ],
      verifiedAttributes: [
        {
          assignmentDate: dateAtRomeZone(
            validTenantVerifiedAttribute.assignmentTimestamp
          ),
          assignmentTime: timeAtRomeZone(
            validTenantVerifiedAttribute.assignmentTimestamp
          ),
          attributeName: verifiedAttribute.name,
          attributeId: verifiedAttribute.id,
          expirationDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
          delegationId: undefined,
        },
      ],

      producerDelegationId: undefined,
      producerDelegateName: undefined,
      producerDelegateIpaCode: undefined,
      consumerDelegationId: undefined,
      consumerDelegateName: undefined,
      consumerDelegateIpaCode: undefined,
    };

    expect(pdfGenerator.generate).toHaveBeenCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src/",
        "resources/agreement/",
        "agreementContractTemplate.html"
      ),
      expectedPayload
    );

    expect(mockAddUnsignedAgreementContractMetadataFn).toHaveBeenCalledWith(
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
          agreementId: mockAgreement.id,
        },
        headers: testHeaders,
      })
    );
  });

  it("should not process an 'AgreementAdded' event and only log an info message", async () => {
    const mockAgreement = getMockAgreement(mockEServiceId, mockConsumerId);

    const mockEvent: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockAgreementId,
      version: 1,
      event_version: 1,
      type: "AgreementAdded",
      data: { agreement: toAgreementV1(mockAgreement) },
      log_date: new Date(),
    };

    const pdfGeneratorSpy = vi.spyOn(pdfGenerator, "generate");
    const fileManagerSpy = vi.spyOn(fileManager, "resumeOrStoreBytes");

    await expect(
      handleAgreementMessageV1(
        mockEvent,
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        clients,
        genericLogger
      )
    ).resolves.toBeUndefined();
    expect(pdfGeneratorSpy).not.toHaveBeenCalled();
    expect(fileManagerSpy).not.toHaveBeenCalled();
  });

  it("should throw eServiceNotFound error if EService is missing for an 'AgreementActivated' event", async () => {
    const mockAgreement = {
      ...getMockAgreement(mockEServiceId, mockConsumerId, "Active"),
      producerId: mockProducerId,
      id: mockAgreementId,
      stamps: {
        submission: { who: generateId<UserId>(), when: new Date() },
        activation: { who: generateId<UserId>(), when: new Date() },
      },
    };

    const mockEvent: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockAgreementId,
      version: 1,
      event_version: 1,
      type: "AgreementActivated",
      data: { agreement: toAgreementV1(mockAgreement) },
      log_date: new Date(),
    };

    await expect(
      handleAgreementMessageV1(
        mockEvent,
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        clients,
        genericLogger
      )
    ).rejects.toThrow(eServiceNotFound(mockEServiceId).message);

    expect(pdfGenerator.generate).not.toHaveBeenCalled();
  });

  it("should throw tenantNotFound error if Consumer Tenant is missing for an 'AgreementActivated' event", async () => {
    const mockAgreement = {
      ...getMockAgreement(mockEServiceId, mockConsumerId, "Active"),
      producerId: mockProducerId,
      id: mockAgreementId,
      stamps: {
        submission: { who: generateId<UserId>(), when: new Date() },
        activation: { who: generateId<UserId>(), when: new Date() },
      },
    };

    const mockEvent: AgreementEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mockAgreementId,
      version: 1,
      event_version: 1,
      type: "AgreementActivated",
      data: { agreement: toAgreementV1(mockAgreement) },
      log_date: new Date(),
    };

    const mockDescriptorId = generateId<DescriptorId>();

    const newDescriptor = {
      ...getMockDescriptorPublished(),
      id: mockDescriptorId,
      state: descriptorState.suspended,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    const newMockEService = {
      ...getMockEService(mockEServiceId, mockProducerId, [newDescriptor]),
    };
    await addOneEService(newMockEService);

    await expect(
      handleAgreementMessageV1(
        mockEvent,
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        clients,
        genericLogger
      )
    ).rejects.toThrow(tenantNotFound(mockConsumerId).message);

    expect(pdfGenerator.generate).not.toHaveBeenCalled();
  });
});
