/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  agreementApi,
  catalogApi,
  purposeApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { userRole } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  generateId,
  PurposeId,
  PurposeTemplateId,
  TenantId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";

import { purposeServiceBuilder } from "../src/services/purposeService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getPurposes — bulk enrichment", () => {
  const consumerId = generateId<TenantId>();
  const producerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const descriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.PUBLISHED,
  });

  const eservice: catalogApi.EService = {
    id: eserviceId,
    name: "eservice",
    producerId,
    description: "description",
    technology: catalogApi.EServiceTechnology.Values.REST,
    descriptors: [descriptor],
    riskAnalysis: [],
    mode: catalogApi.EServiceMode.Values.DELIVER,
    isSignalHubEnabled: false,
    isConsumerDelegable: false,
    isClientAccessDelegable: false,
  };

  const consumer: tenantApi.Tenant = {
    id: consumerId,
    name: "consumer",
    attributes: [],
    externalId: { origin: "IPA", value: "consumer" },
    createdAt: new Date().toISOString(),
    mails: [],
    features: [],
  };

  const producer: tenantApi.Tenant = {
    ...consumer,
    id: producerId,
    name: "producer",
    externalId: { origin: "IPA", value: "producer" },
  };

  const purposeTemplate: purposeTemplateApi.PurposeTemplate = {
    id: purposeTemplateId,
    targetDescription: "target",
    targetTenantKind: purposeTemplateApi.TargetTenantKind.Enum.PA,
    creatorId: producerId,
    state: purposeTemplateApi.PurposeTemplateState.Enum.PUBLISHED,
    createdAt: new Date().toISOString(),
    purposeTitle: "purpose template",
    purposeDescription: "description",
    purposeIsFreeOfCharge: false,
    handlesPersonalData: false,
  };

  const purposes: purposeApi.Purpose[] = [
    generateId<PurposeId>(),
    generateId<PurposeId>(),
  ].map((id) => ({
    id,
    eserviceId,
    consumerId,
    purposeTemplateId,
    title: `purpose ${id}`,
    description: "description",
    isFreeOfCharge: false,
    createdAt: new Date().toISOString(),
    versions: [],
  }));

  const agreement: agreementApi.Agreement = {
    id: generateId(),
    eserviceId,
    descriptorId: descriptor.id,
    producerId,
    consumerId,
    state: agreementApi.AgreementState.Values.ACTIVE,
    verifiedAttributes: [],
    certifiedAttributes: [],
    certifiedDiscreteAttributes: [],
    declaredAttributes: [],
    consumerDocuments: [],
    stamps: {},
    createdAt: new Date().toISOString(),
  };

  const getPurposes = vi.fn();
  const getEServices = vi.fn();
  const getEServiceById = vi.fn();
  const getTenants = vi.fn();
  const getTenant = vi.fn();
  const getPurposeTemplates = vi.fn();
  const getPurposeTemplate = vi.fn();
  const getAgreements = vi.fn();

  const purposeService = purposeServiceBuilder(
    {
      purposeProcessClient: { getPurposes },
      purposeTemplateProcessClient: {
        getPurposeTemplates,
        getPurposeTemplate,
      },
      catalogProcessClient: { getEServices, getEServiceById },
      tenantProcessClient: { tenant: { getTenants, getTenant } },
      agreementProcessClient: { getAgreements },
      authorizationClient: {},
      delegationProcessClient: {},
      selfcareV2UserClient: {},
      inAppNotificationManagerClient: {
        filterUnreadNotifications: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PagoPAInteropBeClients,
    fileManager
  );

  beforeEach(() => {
    vi.clearAllMocks();
    getPurposes.mockResolvedValue({ results: purposes, totalCount: 2 });
    getEServices.mockResolvedValue({ results: [eservice], totalCount: 1 });
    getTenants.mockResolvedValue({
      results: [consumer, producer],
      totalCount: 2,
    });
    getPurposeTemplates.mockResolvedValue({
      results: [purposeTemplate],
      totalCount: 1,
    });
    getAgreements.mockResolvedValue({ results: [agreement], totalCount: 1 });
  });

  it("retrieves shared enrichment resources in bulk without changing the response", async () => {
    const authData = getMockAuthData(undefined, undefined, [
      userRole.VIEWER_ROLE,
    ]);
    const ctx = getBffMockContext(getMockContext({ authData }));

    const result = await purposeService.getConsumerPurposes({}, 0, 50, ctx);

    expect(result.pagination).toEqual({ offset: 0, limit: 50, totalCount: 2 });
    expect(result.results).toHaveLength(2);
    expect(result.results.map((purpose) => purpose.purposeTemplate)).toEqual([
      { id: purposeTemplateId, purposeTitle: purposeTemplate.purposeTitle },
      { id: purposeTemplateId, purposeTitle: purposeTemplate.purposeTitle },
    ]);
    expect(result.results.map((purpose) => purpose.eservice.id)).toEqual([
      eserviceId,
      eserviceId,
    ]);
    expect(result.results.map((purpose) => purpose.consumer.id)).toEqual([
      consumerId,
      consumerId,
    ]);

    expect(getEServices).toHaveBeenCalledOnce();
    expect(getEServices).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({ eservicesIds: [eserviceId] }),
      })
    );
    expect(getTenants).toHaveBeenCalledOnce();
    expect(getTenants).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({
          tenantIds: expect.arrayContaining([consumerId, producerId]),
        }),
      })
    );
    expect(getPurposeTemplates).toHaveBeenCalledOnce();
    expect(getPurposeTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({
          purposeTemplateIds: [purposeTemplateId],
          excludeExpiredRiskAnalysis: false,
        }),
      })
    );
    expect(getEServiceById).not.toHaveBeenCalled();
    expect(getTenant).not.toHaveBeenCalled();
    expect(getPurposeTemplate).not.toHaveBeenCalled();
  });
});
