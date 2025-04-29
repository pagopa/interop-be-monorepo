/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
} from "../../mockUtils.js";
import { toM2MPurpose } from "../../../src/api/purposeApiConverter.js";

describe("getPurpose", () => {
  const mockApiPurposeResponse = getMockedApiPurpose();

  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurposeResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeResponse: m2mGatewayApi.Purpose = toM2MPurpose(
      mockApiPurposeResponse.data
    );

    const result = await purposeService.getPurpose(
      getMockM2MAdminAppContext(),
      unsafeBrandId(m2mPurposeResponse.id)
    );

    expect(result).toEqual(m2mPurposeResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: {
        purposeId: m2mPurposeResponse.id,
      },
    });
  });
});
