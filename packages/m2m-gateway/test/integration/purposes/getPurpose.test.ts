import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
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
    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurposeResponse.data.consumerId,
      createdAt: mockApiPurposeResponse.data.createdAt,
      description: mockApiPurposeResponse.data.description,
      eserviceId: mockApiPurposeResponse.data.eserviceId,
      id: mockApiPurposeResponse.data.id,
      isFreeOfCharge: mockApiPurposeResponse.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurposeResponse.data.isRiskAnalysisValid,
      title: mockApiPurposeResponse.data.title,
      currentVersion: purposeVersion
        ? testToM2mGatewayApiPurposeVersion(purposeVersion)
        : undefined,
      delegationId: mockApiPurposeResponse.data.delegationId,
      freeOfChargeReason: mockApiPurposeResponse.data.freeOfChargeReason,
      rejectedVersion: undefined,
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      updatedAt: mockApiPurposeResponse.data.updatedAt,
      waitingForApprovalVersion: undefined,
      purposeTemplateId: mockApiPurposeResponse.data.purposeTemplateId,
    };

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
