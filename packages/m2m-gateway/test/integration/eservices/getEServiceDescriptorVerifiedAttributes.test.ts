import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiEServiceDescriptorAttributes } from "../../../src/api/eserviceApiConverter.js";

describe("getEserviceDescriptorVerifiedAttributes", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor, getMockedApiEserviceDescriptor()],
  });

  const mockProcessResponse = getMockWithMetadata(mockEService);

  const mockGetEService = vi.fn().mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const expectedResponse = toM2MGatewayApiEServiceDescriptorAttributes(
      mockDescriptor.attributes.verified
    );

    const result =
      await eserviceService.getEserviceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEService,
      params: { eServiceId: mockEService.id },
    });
  });

  it("Should throw eserviceDescriptorNotFound when the descriptor does not exist", async () => {
    const nonExistingDescriptorId = generateId();
    await expect(
      eserviceService.getEserviceDescriptorVerifiedAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(nonExistingDescriptorId),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(mockEService.id, nonExistingDescriptorId)
    );
  });
});
