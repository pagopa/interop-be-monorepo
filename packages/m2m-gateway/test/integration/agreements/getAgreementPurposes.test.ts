import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockWithMetadata,
  getMockedApiAgreement,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  agreementService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurpose,
  testToM2mGatewayApiPurposeVersion,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getAgreementPurposes", () => {
  const mockParams: m2mGatewayApi.GetAgreementPurposesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const mockApiAgreement = getMockWithMetadata(getMockedApiAgreement());
  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockApiPurposes = [mockApiPurpose1, mockApiPurpose2];

  const mockPurposeProcessResponse: WithMaybeMetadata<purposeApi.Purposes> = {
    data: {
      results: mockApiPurposes,
      totalCount: mockApiPurposes.length,
    },
    metadata: undefined,
  };

  const mockGetAgreement = vi.fn().mockResolvedValue(mockApiAgreement);
  const mockGetAgreementPurposes = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessResponse);

  mockInteropBeClients.purposeProcessClient = {
    getPurposes: mockGetAgreementPurposes,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  mockInteropBeClients.agreementProcessClient = {
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    mockGetAgreementPurposes.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const purposeVersion1 = mockApiPurpose1.versions.at(0);
    const expectedM2MPurpose1: m2mGatewayApi.Purpose =
      testToM2mGatewayApiPurpose(mockApiPurpose1, {
        currentVersion: purposeVersion1
          ? testToM2mGatewayApiPurposeVersion(purposeVersion1)
          : undefined,
        waitingForApprovalVersion: undefined,
        rejectedVersion: undefined,
      });

    const purposeVersion2 = mockApiPurpose2.versions.at(0);
    const expectedM2MPurpose2: m2mGatewayApi.Purpose =
      testToM2mGatewayApiPurpose(mockApiPurpose2, {
        currentVersion: purposeVersion2
          ? testToM2mGatewayApiPurposeVersion(purposeVersion2)
          : undefined,
        waitingForApprovalVersion: undefined,
        rejectedVersion: undefined,
      });

    const m2mPurposesResponse: m2mGatewayApi.Purposes = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockPurposeProcessResponse.data.totalCount,
      },
      results: [expectedM2MPurpose1, expectedM2MPurpose2],
    };

    const result = await agreementService.getAgreementPurposes(
      unsafeBrandId(mockApiAgreement.data.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mPurposesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: {
        agreementId: mockApiAgreement.data.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurposes,
      queries: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        consumersIds: [mockApiAgreement.data.consumerId],
        eservicesIds: [mockApiAgreement.data.eserviceId],
        producersIds: [],
        clientId: undefined,
        states: [],
        excludeDraft: false,
        name: undefined,
      },
    });
  });
});
