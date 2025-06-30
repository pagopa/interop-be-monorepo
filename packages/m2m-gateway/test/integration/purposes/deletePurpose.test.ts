import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockedApiPurpose } from "pagopa-interop-commons-test";
import {
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deletePurpose", () => {
  const mockApiPurpose = getMockedApiPurpose();

  const mockDeletePurpose = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    deletePurpose: mockDeletePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockDeletePurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await purposeService.deletePurpose(
      unsafeBrandId(mockApiPurpose.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.deletePurpose,
      params: {
        id: mockApiPurpose.id,
      },
    });
  });
});
