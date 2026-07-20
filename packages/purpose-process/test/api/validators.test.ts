import {
  EService,
  Purpose,
  Tenant,
  Agreement,
  tenantKind,
  eserviceMode,
  tenantAttributeType,
  attributeCertifiedDiscreteComparator,
  AttributeCertifiedDiscreteComparator,
  CertifiedDiscreteTenantAttribute,
  EServiceAttributeCertified,
  EServiceAttributeCertifiedDiscrete,
  EServiceId,
  DescriptorId,
  TenantId,
  AttributeId,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";

import { config } from "../../src/config/config.js";
import {
  descriptorNotFound,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { retrieveActiveAgreement } from "../../src/services/purposeService.js";
import { ReadModelServiceSQL } from "../../src/services/readModelServiceSQL.js";
import {
  isOverQuota,
  getUpdatedQuotas,
} from "../../src/services/validators.js";

vi.mock("../../src/services/purposeService.js", () => ({
  retrieveActiveAgreement: vi.fn(),
}));

const mockReadModelService = {
  getActiveVersionsDailyCalls: vi.fn(),
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
        serverUrlsDescriptions: [],
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
    certifiedDiscreteAttributes: [],
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
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

describe("getUpdatedQuotas", () => {
  const eserviceId = "eservice-id" as EServiceId;
  const consumerId = "consumer-id" as TenantId;
  const descriptorId = "descriptor-id" as DescriptorId;
  const producerId = "producer-id" as TenantId;
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
        serverUrlsDescriptions: [],
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

  const agreement: Agreement = {
    id: unsafeBrandId(agreementId),
    eserviceId,
    descriptorId,
    producerId: eservice.producerId,
    consumerId,
    state: "Active",
    verifiedAttributes: [],
    certifiedAttributes: [],
    certifiedDiscreteAttributes: [],
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

  it("should return the correct updated quotas", async () => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    // consumer active versions sum = 10 (draft excluded), total across consumers = 30
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 10, totalDailyCalls: 30 });
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);

    const result = await getUpdatedQuotas(
      eservice,
      consumerId,
      mockReadModelService
    );

    expect(result).toEqual({
      currentConsumerCalls: 10,
      currentTotalCalls: 30,
      maxDailyCallsPerConsumer: 100,
      maxDailyCallsTotal: 1000,
    });
  });

  it("should consider certified attributes for maxDailyCallsPerConsumer", async () => {
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
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(
      tenantWithCertifiedAttributes
    );

    const result = await getUpdatedQuotas(
      eserviceWithCertifiedAttributes,
      consumerId,
      mockReadModelService
    );

    expect(result).toEqual({
      currentConsumerCalls: 0,
      currentTotalCalls: 0,
      maxDailyCallsPerConsumer: 200,
      maxDailyCallsTotal: 1000,
    });
  });

  it("should throw descriptorNotFound if the descriptor is not found", async () => {
    const agreementWithInvalidDescriptor: Agreement = {
      ...agreement,
      descriptorId: "invalid-descriptor-id" as DescriptorId,
    };
    (retrieveActiveAgreement as Mock).mockResolvedValue(
      agreementWithInvalidDescriptor
    );
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);

    await expect(
      getUpdatedQuotas(eservice, consumerId, mockReadModelService)
    ).rejects.toThrow(
      descriptorNotFound(
        eservice.id,
        agreementWithInvalidDescriptor.descriptorId
      )
    );
  });

  it("should throw tenantNotFound if the tenant is not found", async () => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(undefined);

    await expect(
      getUpdatedQuotas(eservice, consumerId, mockReadModelService)
    ).rejects.toThrow(tenantNotFound(consumerId));
  });
});

describe("getUpdatedQuotas - certified discrete attributes", () => {
  const eserviceId = "eservice-id" as EServiceId;
  const consumerId = "consumer-id" as TenantId;
  const descriptorId = "descriptor-id" as DescriptorId;
  const producerId = "producer-id" as TenantId;
  const agreementId = "agreement-id";
  const discreteAttributeId = "discrete-attribute-id" as AttributeId;
  const plainAttributeId = "plain-attribute-id" as AttributeId;

  const DESCRIPTOR_DEFAULT_PER_CONSUMER = 100;
  const DESCRIPTOR_TOTAL = 1000;

  const buildEService = (
    certified: Array<
      Array<EServiceAttributeCertified | EServiceAttributeCertifiedDiscrete>
    >
  ): EService => ({
    id: eserviceId,
    producerId,
    name: "eservice name",
    description: "eservice description",
    technology: "Rest",
    mode: eserviceMode.deliver,
    descriptors: [
      {
        id: descriptorId,
        version: "1",
        docs: [],
        state: "Published",
        audience: [],
        voucherLifespan: 0,
        dailyCallsPerConsumer: DESCRIPTOR_DEFAULT_PER_CONSUMER,
        dailyCallsTotal: DESCRIPTOR_TOTAL,
        interface: undefined,
        agreementApprovalPolicy: "Automatic",
        serverUrls: [],
        serverUrlsDescriptions: [],
        attributes: {
          certified,
          declared: [],
          verified: [],
        },
        createdAt: new Date(),
      },
    ],
    createdAt: new Date(),
    riskAnalysis: [],
  });

  const discreteDescriptorAttribute = (
    threshold: number,
    comparator: AttributeCertifiedDiscreteComparator,
    dailyCallsPerConsumer: number | undefined,
    id: AttributeId = discreteAttributeId
  ): EServiceAttributeCertifiedDiscrete => ({
    id,
    explicitAttributeVerification: false,
    ...(dailyCallsPerConsumer !== undefined ? { dailyCallsPerConsumer } : {}),
    discreteConfig: { threshold, comparator },
  });

  const discreteTenantAttribute = (
    discreteValue: number,
    revoked = false,
    id: AttributeId = discreteAttributeId
  ): CertifiedDiscreteTenantAttribute => ({
    id,
    type: tenantAttributeType.CERTIFIED_DISCRETE,
    assignmentTimestamp: new Date(),
    revocationTimestamp: revoked ? new Date() : undefined,
    discreteValue,
  });

  const agreement: Agreement = {
    id: unsafeBrandId(agreementId),
    eserviceId,
    descriptorId,
    producerId,
    consumerId,
    state: "Active",
    verifiedAttributes: [],
    certifiedAttributes: [],
    certifiedDiscreteAttributes: [],
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

  const tenantWith = (attributes: Tenant["attributes"]): Tenant => ({
    id: consumerId,
    kind: tenantKind.PA,
    selfcareId: "selfcare-id",
    externalId: { origin: "origin", value: "value" },
    features: [],
    attributes,
    createdAt: new Date(),
    name: "tenant name",
    mails: [],
  });

  const runWith = async (
    eservice: EService,
    tenant: Tenant
  ): Promise<Awaited<ReturnType<typeof getUpdatedQuotas>>> => {
    (retrieveActiveAgreement as Mock).mockResolvedValue(agreement);
    (
      mockReadModelService.getActiveVersionsDailyCalls as Mock
    ).mockResolvedValue({ consumerDailyCalls: 0, totalDailyCalls: 0 });
    (mockReadModelService.getTenantById as Mock).mockResolvedValue(tenant);
    return getUpdatedQuotas(eservice, consumerId, mockReadModelService);
  };

  beforeEach(() => {
    vi.resetAllMocks();
    config.featureFlagAttributeCertifiedDiscrete = true;
  });

  afterEach(() => {
    config.featureFlagAttributeCertifiedDiscrete = false;
  });

  it("applies the differentiated quota when the discrete value satisfies the threshold", async () => {
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200
        ),
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(200);
  });

  it("applies the differentiated quota even when it is lower than the descriptor default", async () => {
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          50
        ),
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(50);
  });

  it("falls back to the descriptor default when the discrete value does NOT satisfy the threshold", async () => {
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200
        ),
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(
      DESCRIPTOR_DEFAULT_PER_CONSUMER
    );
  });

  it("falls back to the descriptor default when the consumer does not hold the discrete attribute", async () => {
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200
        ),
      ],
    ]);
    const tenant = tenantWith([]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(
      DESCRIPTOR_DEFAULT_PER_CONSUMER
    );
  });

  it("ignores a revoked discrete attribute even if its value would satisfy the threshold", async () => {
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200
        ),
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500, true)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(
      DESCRIPTOR_DEFAULT_PER_CONSUMER
    );
  });

  it("ignores a discrete attribute that has no differentiated quota even when satisfied", async () => {
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          undefined
        ),
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(
      DESCRIPTOR_DEFAULT_PER_CONSUMER
    );
  });

  describe.each<{
    comparator: AttributeCertifiedDiscreteComparator;
    pass: number;
    fail: number;
  }>([
    {
      comparator: attributeCertifiedDiscreteComparator.GT,
      pass: 1001,
      fail: 1000,
    },
    {
      comparator: attributeCertifiedDiscreteComparator.LT,
      pass: 999,
      fail: 1000,
    },
    {
      comparator: attributeCertifiedDiscreteComparator.EQ,
      pass: 1000,
      fail: 999,
    },
    {
      comparator: attributeCertifiedDiscreteComparator.GTE,
      pass: 1000,
      fail: 999,
    },
    {
      comparator: attributeCertifiedDiscreteComparator.LTE,
      pass: 1000,
      fail: 1001,
    },
    {
      comparator: attributeCertifiedDiscreteComparator.NE,
      pass: 999,
      fail: 1000,
    },
  ])("comparator $comparator", ({ comparator, pass, fail }) => {
    it(`applies the differentiated quota when value satisfies ${comparator}`, async () => {
      const eservice = buildEService([
        [discreteDescriptorAttribute(1000, comparator, 200)],
      ]);
      const tenant = tenantWith([discreteTenantAttribute(pass)]);

      const result = await runWith(eservice, tenant);

      expect(result.maxDailyCallsPerConsumer).toBe(200);
    });

    it(`falls back to default when value does not satisfy ${comparator}`, async () => {
      const eservice = buildEService([
        [discreteDescriptorAttribute(1000, comparator, 200)],
      ]);
      const tenant = tenantWith([discreteTenantAttribute(fail)]);

      const result = await runWith(eservice, tenant);

      expect(result.maxDailyCallsPerConsumer).toBe(
        DESCRIPTOR_DEFAULT_PER_CONSUMER
      );
    });
  });

  it("picks the highest differentiated quota across multiple satisfied discrete attributes", async () => {
    const secondAttributeId = "discrete-attribute-id-2" as AttributeId;
    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200,
          discreteAttributeId
        ),
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          500,
          secondAttributeId
        ),
      ],
    ]);
    const tenant = tenantWith([
      discreteTenantAttribute(1500, false, discreteAttributeId),
      discreteTenantAttribute(1500, false, secondAttributeId),
    ]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(500);
  });

  it("combines plain certified and discrete certified attributes, taking the max satisfied quota", async () => {
    const eservice = buildEService([
      [
        {
          id: plainAttributeId,
          explicitAttributeVerification: false,
          dailyCallsPerConsumer: 300,
        },
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200
        ),
      ],
    ]);
    const tenant = tenantWith([
      {
        id: plainAttributeId,
        type: tenantAttributeType.CERTIFIED,
        assignmentTimestamp: new Date(),
        revocationTimestamp: undefined,
      },
      discreteTenantAttribute(1500),
    ]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(300);
  });

  it("ignores discrete descriptor attributes when the feature flag is disabled", async () => {
    config.featureFlagAttributeCertifiedDiscrete = false;

    const eservice = buildEService([
      [
        discreteDescriptorAttribute(
          1000,
          attributeCertifiedDiscreteComparator.GTE,
          200
        ),
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(
      DESCRIPTOR_DEFAULT_PER_CONSUMER
    );
  });

  it("does not apply a plain certified quota to a discrete-only tenant attribute when the flag is disabled", async () => {
    config.featureFlagAttributeCertifiedDiscrete = false;

    const eservice = buildEService([
      [
        {
          id: discreteAttributeId,
          explicitAttributeVerification: false,
          dailyCallsPerConsumer: 200,
        },
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(
      DESCRIPTOR_DEFAULT_PER_CONSUMER
    );
  });

  it("applies a plain certified quota to a discrete tenant attribute when the flag is enabled", async () => {
    const eservice = buildEService([
      [
        {
          id: discreteAttributeId,
          explicitAttributeVerification: false,
          dailyCallsPerConsumer: 200,
        },
      ],
    ]);
    const tenant = tenantWith([discreteTenantAttribute(1500)]);

    const result = await runWith(eservice, tenant);

    expect(result.maxDailyCallsPerConsumer).toBe(200);
  });
});
