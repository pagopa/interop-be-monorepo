import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("cancelEServiceArchiving", () => {
  const mockApiEservice = getMockWithMetadata(getMockedApiEservice(), 1);
  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice.data);

  const mockCancelArchiving = vi
    .fn()
    .mockResolvedValue({ data: undefined, metadata: { version: 0 } });
  const mockGetEservice = vi.fn().mockResolvedValue(mockApiEservice);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
    cancelScheduleArchiveEservice: mockCancelArchiving,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockCancelArchiving.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceService.cancelEServiceArchiving(
      unsafeBrandId(mockApiEservice.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(mockM2MEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCancelArchiving,
      params: {
        eServiceId: mockApiEservice.data.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEservice.data.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });
});
