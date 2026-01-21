import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agreementApi, catalogApi } from "pagopa-interop-api-clients";
import { EServiceId, generateId, TenantId } from "pagopa-interop-models";
import { AuthData, formatDateyyyyMMddTHHmmss } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import * as commons from "pagopa-interop-commons";
import {
  AttributeProcessClient,
  DelegationProcessClient,
  EServiceTemplateProcessClient,
  InAppNotificationManagerClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { fileManager, getBffMockContext } from "./utils.js";

describe("getEServiceConsumers", () => {
  const tenantId: TenantId = generateId<TenantId>();
  const eServiceId: EServiceId = generateId<EServiceId>();
  const eService: catalogApi.EService = {
    id: eServiceId,
    name: "mockEService",
    producerId: "mockProducerId",
    description: "mockDescription",
    technology: "REST",
    descriptors: [],
    mode: "RECEIVE",
    riskAnalysis: [],
  };

  const expectedEServiceConsumer: catalogApi.EServiceConsumer = {
    agreementState: "DRAFT",
    consumerExternalId: "mockConsumerExternalId",
    consumerName: "mockConsumerName",
    descriptorState: "DRAFT",
    descriptorVersion: 1,
  };

  const mockCatalogProcessClient = {
    getEServiceById: vi.fn().mockResolvedValue(eService),
  } as unknown as catalogApi.CatalogProcessClient;
  const mockTenantProcessClient = {} as unknown as TenantProcessClient;
  const mockAgreementProcessClient =
    {} as unknown as agreementApi.AgreementProcessClient;
  const mockAttributeProcessClient = {} as unknown as AttributeProcessClient;
  const mockDelegationProcessClient = {} as unknown as DelegationProcessClient;
  const mockEServiceTemplateProcessClient =
    {} as unknown as EServiceTemplateProcessClient;
  const mockIInAppNotificationManagerClient =
    {} as unknown as InAppNotificationManagerClient;

  const catalogService = catalogServiceBuilder(
    mockCatalogProcessClient,
    mockTenantProcessClient,
    mockAgreementProcessClient,
    mockAttributeProcessClient,
    mockDelegationProcessClient,
    mockEServiceTemplateProcessClient,
    mockIInAppNotificationManagerClient,
    fileManager,
    config
  );

  const authData: AuthData = {
    ...getMockAuthData(),
    organizationId: tenantId,
  };

  const bffMockContext = getBffMockContext(getMockContext({ authData }));

  vi.spyOn(commons, "getAllFromPaginated").mockResolvedValue([
    expectedEServiceConsumer,
  ]);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return filename and file buffer", async () => {
    const result = await catalogService.getEServiceConsumers(
      eServiceId,
      bffMockContext
    );
    expect(mockCatalogProcessClient.getEServiceById).toHaveBeenCalledWith({
      params: {
        eServiceId,
      },
      headers: bffMockContext.headers,
    });
    const currentDate = formatDateyyyyMMddTHHmmss(new Date());
    const expectedFilename = `${currentDate}-lista-fruitori-${eService.name}.csv`;
    expect(result.filename).toBe(expectedFilename);

    const expectedContent =
      "versione,stato_versione,stato_richiesta_fruizione,fruitore,codice_ipa_fruitore\n" +
      `${expectedEServiceConsumer.descriptorVersion},${expectedEServiceConsumer.descriptorState},${expectedEServiceConsumer.agreementState},${expectedEServiceConsumer.consumerName},${expectedEServiceConsumer.consumerExternalId}`;

    expect(result.file.toString()).toBe(expectedContent);
  });
  it("should handle empty consumers list", async () => {
    vi.spyOn(commons, "getAllFromPaginated").mockResolvedValue([]);

    const result = await catalogService.getEServiceConsumers(
      eServiceId,
      bffMockContext
    );

    const currentDate = formatDateyyyyMMddTHHmmss(new Date());
    const expectedFilename = `${currentDate}-lista-fruitori-${eService.name}.csv`;
    expect(result.filename).toBe(expectedFilename);

    const expectedContentWithHeaderOnly =
      "versione,stato_versione,stato_richiesta_fruizione,fruitore,codice_ipa_fruitore";

    expect(result.file.toString()).toBe(expectedContentWithHeaderOnly);

    vi.useRealTimers();
  });
});
