import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import {
  getMockedApiAgreement,
  getMockedApiDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  agreementService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiAgreement,
} from "../../mockUtils.js";

describe("createAgreement", () => {
  const mockAgreementSeed: m2mGatewayApiV3.AgreementSeed = generateMock(
    m2mGatewayApiV3.AgreementSeed
  );

  const mockAgreementProcessResponse = getMockWithMetadata(
    getMockedApiAgreement({
      state: agreementApi.AgreementState.Values.DRAFT,
      eserviceId: mockAgreementSeed.eserviceId,
      descriptorId: mockAgreementSeed.descriptorId,
      stamps: {},
    })
  );

  const mockCreateAgreement = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  const mockGetAgreement = vi.fn(
    mockPollingResponse(mockAgreementProcessResponse, 2)
  );

  const mockDelegation = getMockedApiDelegation();
  mockInteropBeClients.delegationProcessClient = {
    delegation: {
      getDelegations: vi
        .fn()
        .mockResolvedValue(getMockWithMetadata({ results: [mockDelegation] })),
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  mockInteropBeClients.agreementProcessClient = {
    createAgreement: mockCreateAgreement,
    getAgreementById: mockGetAgreement,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateAgreement.mockClear();
    mockGetAgreement.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mAgreementResponse: m2mGatewayApiV3.Agreement = {
      ...testToM2mGatewayApiAgreement(mockAgreementProcessResponse.data),
      delegationId: mockDelegation.id,
    };

    const result = await agreementService.createAgreement(
      mockAgreementSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mAgreementResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.agreementProcessClient.createAgreement,
      body: mockAgreementSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.agreementProcessClient.getAgreementById,
      params: { agreementId: m2mAgreementResponse.id },
    });
    expect(mockGetAgreement).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the agreement returned by the creation POST call has no metadata", async () => {
    mockCreateAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.createAgreement(
        mockAgreementSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the agreement returned by the polling GET call has no metadata", async () => {
    mockGetAgreement.mockResolvedValueOnce({
      ...mockAgreementProcessResponse,
      metadata: undefined,
    });

    await expect(
      agreementService.createAgreement(
        mockAgreementSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetAgreement.mockImplementation(
      mockPollingResponse(
        mockAgreementProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      agreementService.createAgreement(
        mockAgreementSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetAgreement).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
