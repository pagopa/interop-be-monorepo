import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import {
  EService,
  Purpose,
  Tenant,
  Agreement,
  tenantKind,
  eserviceMode,
  tenantAttributeType,
  EServiceId,
  DescriptorId,
  TenantId,
  AttributeId,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { isOverQuota } from "../../src/services/validators.js";
import {
  descriptorNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { ReadModelServiceSQL } from "../../src/services/readModelServiceSQL.js";
import { retrieveActiveAgreement } from "../../src/services/purposeService.js";

vi.mock("../../src/services/purposeService.js", () => ({
  retrieveActiveAgreement: vi.fn(),
}));

const mockReadModelService = {
  getAllPurposes: vi.fn(),
  getActiveAgreement: vi.fn(),
  getTenantById: vi.fn(),
  getEServiceById: vi.fn(),
} as unknown as ReadModelServiceSQL;

describe("isOverQuota", () => {
  const eserviceId = "eservice-id" as EServiceId;
  const consumerId = "consumer-id" as TenantId;
  const descriptorId = "descriptor-id" as DescriptorId;
  const producerId = "producer-id" as TenantId;
  const purposeId = "purpose-id" as PurposeId;
  const agreementId = "agreement-id";
  const selfcareId = "selfcare-id";
  const attributeId = "attribute-id" as AttributeId;

  const eservice: EService = {
    id: eserviceId,
    producerId,
    name: "eservice name",
    description: "eservice description",
    technology: "Rest",
    mode: eserviceMode.deliver,
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
    descriptors: [
      {
        id: descriptorId,
        version: "1",
        docs: [],
        state: "Published",
        audience: [],
        voucherLifespan: 0,
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 1000,
        interface: undefined,
        agreementApprovalPolicy: "Automatic",
        serverUrls: [],
        attributes: {
          certified: [],
          declared: [],
          verified: [],
        },
        createdAt: new Date(),
      },
    ],
    createdAt: new Date(),
    riskAnalysis: [],
  };

  const purpose: Purpose = {
    id: purposeId,
    eserviceId,
    consumerId,
    versions: [],
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    title: "purpose title",
    description: "purpose description",
    riskAnalysisForm: undefined,
    createdAt: new Date(),
    updatedAt: undefined,
    isFreeOfCharge: false,
    freeOfChargeReason: undefined,
  };

  const agreement: Agreement = {
    id: unsafeBrandId(agreementId),
    eserviceId,
    descriptorId,
    producerId: eservice.producerId,
    consumerId,
    state: "Active",
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    suspendedByPlatform: undefined,
    createdAt: new Date(),
    updatedAt: undefined,
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
    contract: undefined,
  };

  const tenant: Tenant = {
    id: consumerId,
    kind: tenantKind.PA,
    selfcareId,
    externalId: {
      origin: "origin",
      value: "value",
    },
    features: [],
    attributes: [],
    createdAt: new Date(),
    name: "tenant name",
    mails: [],
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return false if the new daily calls do not exceed any quota", async () => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (mockReadModelService.getAllPurposes as Mock).mockResolvedValue([]);
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);

    const result = await isOverQuota(
      eservice,
      purpose,
      10,
      mockReadModelService
    );
    expect(result).toBe(false);
  });

  it("should return true if the new daily calls exceed the consumer quota", async () => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (mockReadModelService.getAllPurposes as Mock).mockResolvedValue([]);
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);

    const result = await isOverQuota(
      eservice,
      purpose,
      200,
      mockReadModelService
    );
    expect(result).toBe(true);
  });

  it("should return true if the new daily calls exceed the total quota", async () => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (mockReadModelService.getAllPurposes as Mock).mockResolvedValue([]);
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);

    const result = await isOverQuota(
      eservice,
      purpose,
      2000,
      mockReadModelService
    );
    expect(result).toBe(true);
  });

  it("should throw descriptorNotFound if the descriptor is not found", async () => {
    const agreementWithInvalidDescriptor: Agreement = {
      ...agreement,
      descriptorId: "invalid-descriptor-id" as DescriptorId,
    };
    (retrieveActiveAgreement as Mock).mockResolvedValue(
      agreementWithInvalidDescriptor
    );
    (mockReadModelService.getAllPurposes as Mock).mockResolvedValue([]);
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);

    await expect(
      isOverQuota(eservice, purpose, 10, mockReadModelService)
    ).rejects.toThrow(
      descriptorNotFound(
        eservice.id,
        agreementWithInvalidDescriptor.descriptorId
      )
    );
  });

  it("should throw tenantNotFound if the tenant is not found", async () => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (mockReadModelService.getAllPurposes as Mock).mockResolvedValue([]);
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(undefined);

    await expect(
      isOverQuota(eservice, purpose, 10, mockReadModelService)
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it("should consider certified attributes for consumer quota", async () => {
    const eserviceWithCertifiedAttributes: EService = {
      ...eservice,
      descriptors: [
        {
          ...eservice.descriptors[0],
          attributes: {
            certified: [
              [
                {
                  id: attributeId,
                  explicitAttributeVerification: false,
                  dailyCallsPerConsumer: 200,
                },
              ],
            ],
            declared: [],
            verified: [],
          },
        },
      ],
    };

    const tenantWithCertifiedAttributes: Tenant = {
      ...tenant,
      attributes: [
        {
          id: attributeId,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
    };

    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (mockReadModelService.getAllPurposes as Mock).mockResolvedValue([]);
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(
      tenantWithCertifiedAttributes
    );

    const result = await isOverQuota(
      eserviceWithCertifiedAttributes,
      purpose,
      150,
      mockReadModelService
    );
    expect(result).toBe(false);

    const result2 = await isOverQuota(
      eserviceWithCertifiedAttributes,
      purpose,
      250,
      mockReadModelService
    );
    expect(result2).toBe(true);
  });
});
