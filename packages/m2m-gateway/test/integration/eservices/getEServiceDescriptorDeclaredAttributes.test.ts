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

describe("getEserviceDescriptorDeclaredAttributes", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor, getMockedApiEserviceDescriptor()],
  });

  const mockEServiceProcessResponse = getMockWithMetadata(mockEService);

  const mockGetEServiceById = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEServiceById,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetEServiceById.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const expectedResponse = toM2MGatewayApiEServiceDescriptorAttributes(
      mockDescriptor.attributes.declared
    );

    const result =
      await eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServiceById,
      params: { eServiceId: mockEService.id },
    });
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId();
    await expect(
      eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(nonExistingDescriptorId),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(mockEService.id, nonExistingDescriptorId)
    );
  });
});
