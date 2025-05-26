import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockM2MAdminAppContext } from "pagopa-interop-commons-test/src/testUtils.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockedApiPurpose } from "../../mockUtils.js";

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
    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurposeResponse.data.consumerId,
      createdAt: mockApiPurposeResponse.data.createdAt,
      description: mockApiPurposeResponse.data.description,
      eserviceId: mockApiPurposeResponse.data.eserviceId,
      id: mockApiPurposeResponse.data.id,
      isFreeOfCharge: mockApiPurposeResponse.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurposeResponse.data.isRiskAnalysisValid,
      title: mockApiPurposeResponse.data.title,
      currentVersion: mockApiPurposeResponse.data.versions.at(0),
      delegationId: mockApiPurposeResponse.data.delegationId,
      freeOfChargeReason: mockApiPurposeResponse.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurposeResponse.data.updatedAt,
      waitingForApprovalVersion: undefined,
    };

    const result = await purposeService.getPurpose(
      unsafeBrandId(expectedM2MPurpose.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: {
        id: expectedM2MPurpose.id,
      },
    });
  });
});
