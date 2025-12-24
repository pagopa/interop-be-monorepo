import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { purposeVersionNotFound } from "../../../src/model/errors.js";

describe("getPurposeVersion", () => {
  const mockApiPurposeVersionResponse = getMockedApiPurposeVersion();
  const mockApiPurposeResponse = getMockWithMetadata(
    getMockedApiPurpose({
      versions: [mockApiPurposeVersionResponse],
    })
  );

  const mockGetPurpose = vi.fn().mockResolvedValue(mockApiPurposeResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MPurposeVersion: m2mGatewayApiV3.PurposeVersion = {
      createdAt: mockApiPurposeVersionResponse.createdAt,
      dailyCalls: mockApiPurposeVersionResponse.dailyCalls,
      id: mockApiPurposeVersionResponse.id,
      state: mockApiPurposeVersionResponse.state,
      firstActivationAt: mockApiPurposeVersionResponse.firstActivationAt,
      rejectionReason: mockApiPurposeVersionResponse.rejectionReason,
      suspendedAt: mockApiPurposeVersionResponse.suspendedAt,
      updatedAt: mockApiPurposeVersionResponse.updatedAt,
    };

    const result = await purposeService.getPurposeVersion(
      unsafeBrandId(mockApiPurposeResponse.data.id),
      unsafeBrandId(expectedM2MPurposeVersion.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurposeVersion);
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
