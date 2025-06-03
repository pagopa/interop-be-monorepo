import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiEservice,
} from "../../mockUtils.js";
import { getMockWithMetadata } from "pagopa-interop-commons-test";

describe("getEservice", () => {
  const mockCatalogProcessResponse = getMockWithMetadata(
    getMockedApiEservice()
  );
  const mockGetEservice = vi.fn().mockResolvedValue(mockCatalogProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceResponse: m2mGatewayApi.EService = {
      id: mockCatalogProcessResponse.data.id,
      producerId: mockCatalogProcessResponse.data.producerId,
      name: mockCatalogProcessResponse.data.name,
      description: mockCatalogProcessResponse.data.description,
      technology: mockCatalogProcessResponse.data.technology,
      mode: mockCatalogProcessResponse.data.mode,
      isSignalHubEnabled: mockCatalogProcessResponse.data.isSignalHubEnabled,
      isConsumerDelegable: mockCatalogProcessResponse.data.isConsumerDelegable,
      isClientAccessDelegable:
        mockCatalogProcessResponse.data.isClientAccessDelegable,
      templateId: mockCatalogProcessResponse.data.templateId,
    };

    const result = await eserviceService.getEService(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEserviceResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockCatalogProcessResponse.data.id },
    });
  });
});
