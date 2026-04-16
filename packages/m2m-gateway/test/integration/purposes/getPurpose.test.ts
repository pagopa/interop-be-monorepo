import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurpose,
  testToM2mGatewayApiPurposeVersion,
} from "../../mockUtils.js";

describe("getPurpose", () => {
  const mockApiPurposeResponse = getMockWithMetadata(getMockedApiPurpose());

  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurposeResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeVersion = mockApiPurposeResponse.data.versions[0];
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(
      mockApiPurposeResponse.data,
      {
        currentVersion: purposeVersion
          ? testToM2mGatewayApiPurposeVersion(purposeVersion)
          : undefined,
      }
    );

    const result = await purposeService.getPurpose(
      unsafeBrandId(expectedM2MPurpose.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: {
        id: expectedM2MPurpose.id,
      },
    });
  });
});
