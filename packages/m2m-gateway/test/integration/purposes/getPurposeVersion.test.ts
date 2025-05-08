import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";
import { toM2mGatewayApiPurposeVersion } from "../../../src/api/purposeApiConverter.js";
import { purposeVersionNotFound } from "../../../src/model/errors.js";

describe("getPurpose", () => {
  const mockApiPurposeVersionResponse = getMockedApiPurposeVersion();
  const mockApiPurposeResponse = getMockedApiPurpose({
    versions: [mockApiPurposeVersionResponse],
  });

  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurposeResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mPurposeVersionResponse = toM2mGatewayApiPurposeVersion(
      mockApiPurposeVersionResponse
    );

    const result = await purposeService.getPurposeVersion(
      unsafeBrandId(mockApiPurposeResponse.data.id),
      unsafeBrandId(m2mPurposeVersionResponse.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mPurposeVersionResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: {
        id: mockApiPurposeResponse.data.id,
      },
    });
  });

  it("Should throw a purposeVersionNotFound error if version is not in purpose", async () => {
    const randomVersionId = generateId<PurposeVersionId>();

    await expect(
      purposeService.getPurposeVersion(
        unsafeBrandId(mockApiPurposeResponse.data.id),
        randomVersionId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      purposeVersionNotFound(
        unsafeBrandId(mockApiPurposeResponse.data.id),
        randomVersionId
      )
    );
  });
});
