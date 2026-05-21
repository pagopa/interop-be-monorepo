import { describe, expect, it, vi } from "vitest";
import {
  agreementApi,
  attributeRegistryApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { userRole } from "pagopa-interop-commons";
import {
  AgreementId,
  CorrelationId,
  DescriptorId,
  EServiceId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { agreementServiceBuilder } from "../src/services/agreementService.js";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";

describe("getAgreementById", () => {
  it("should include async exchange information in the agreement eservice", async () => {
    const agreementId = generateId<AgreementId>();
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const producerId = generateId<TenantId>();
    const consumerId = generateId<TenantId>();
    const now = new Date().toISOString();

    const agreement: agreementApi.Agreement = {
      id: agreementId,
      eserviceId,
      descriptorId,
      producerId,
      consumerId,
      state: agreementApi.AgreementState.Values.DRAFT,
      verifiedAttributes: [],
      certifiedAttributes: [],
      declaredAttributes: [],
      consumerDocuments: [],
      createdAt: now,
      stamps: {},
    };

    const descriptor: catalogApi.EServiceDescriptor = {
      id: descriptorId,
      version: "1",
      audience: [],
      voucherLifespan: 60,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1,
      docs: [],
      state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
      agreementApprovalPolicy:
        catalogApi.AgreementApprovalPolicy.Values.AUTOMATIC,
      serverUrls: [],
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
      publishedAt: now,
    };

    const eservice: catalogApi.EService = {
      id: eserviceId,
      producerId,
      name: "Async e-service",
      description: "An async e-service",
      technology: catalogApi.EServiceTechnology.Values.REST,
      descriptors: [descriptor],
      riskAnalysis: [],
      mode: catalogApi.EServiceMode.Values.RECEIVE,
      asyncExchange: true,
    };

    const consumer: tenantApi.Tenant = {
      id: consumerId,
      externalId: { origin: "IPA", value: "consumer" },
      features: [],
      attributes: [],
      createdAt: now,
      mails: [],
      name: "Consumer",
    };

    const producer: tenantApi.Tenant = {
      id: producerId,
      externalId: { origin: "IPA", value: "producer" },
      features: [],
      attributes: [],
      createdAt: now,
      mails: [],
      name: "Producer",
    };

    const clients = {
      agreementProcessClient: {
        getAgreementById: vi.fn().mockResolvedValue(agreement),
      } as unknown as agreementApi.AgreementProcessClient,
      tenantProcessClient: {
        tenant: {
          getTenant: vi
            .fn()
            .mockResolvedValueOnce(consumer)
            .mockResolvedValueOnce(producer),
        },
      } as unknown as PagoPAInteropBeClients["tenantProcessClient"],
      catalogProcessClient: {
        getEServiceById: vi.fn().mockResolvedValue(eservice),
      } as unknown as catalogApi.CatalogProcessClient,
      delegationProcessClient: {
        delegation: {
          getDelegations: vi.fn().mockResolvedValue({
            results: [],
            totalCount: 0,
          }),
        },
      } as unknown as PagoPAInteropBeClients["delegationProcessClient"],
      attributeProcessClient: {
        getBulkedAttributes: vi.fn().mockResolvedValue({
          results: [],
          totalCount: 0,
        }),
      } as unknown as attributeRegistryApi.AttributeProcessClient,
    } as unknown as PagoPAInteropBeClients;

    const service = agreementServiceBuilder(clients, {} as never);

    const correlationId = generateId<CorrelationId>();
    const authData = {
      ...getMockAuthData(consumerId),
      organizationId: consumerId,
      userRoles: [userRole.ADMIN_ROLE],
    };
    const ctx = {
      ...getMockContext({
        authData,
        correlationId,
      }),
      headers: {
        Authorization: "Bearer token",
        "X-Correlation-Id": correlationId,
        "X-Forwarded-For": "127.0.0.1",
      },
    };

    const result = await service.getAgreementById(agreementId, ctx);

    expect(result.eservice).toMatchObject({
      id: eserviceId,
      name: eservice.name,
      version: descriptor.version,
      asyncExchange: true,
    });
  });
});
