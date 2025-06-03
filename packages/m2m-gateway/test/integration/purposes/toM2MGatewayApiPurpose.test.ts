import { beforeEach, describe, expect, it, vi } from "vitest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "pagopa-interop-commons-test";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";
import { getMockWithMetadata } from "pagopa-interop-commons-test";

describe("toM2MGatewayApiPurpose", () => {
  const mockGetPurpose = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it.each(
    m2mGatewayApi.PurposeVersionState.options.filter(
      (state) =>
        state !== m2mGatewayApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL &&
        state !== m2mGatewayApi.PurposeVersionState.Enum.REJECTED
    )
  )(
    "should set currentVersion to the latest version not WAITING_FOR_APPROVAL or REJECTED (currentVersionState: %s)",
    async (state) => {
      const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
        state,
      });
      const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
        state,
      });
      const mockApiPurposeVersion3 = getMockedApiPurposeVersion({
        state: purposeApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL,
      });
      const mockApiPurposeVersion4 = getMockedApiPurposeVersion({
        state: purposeApi.PurposeVersionState.Enum.REJECTED,
      });

      const mockApiPurpose = getMockWithMetadata(
        getMockedApiPurpose({
          versions: [
            mockApiPurposeVersion1,
            mockApiPurposeVersion2,
            mockApiPurposeVersion3,
            mockApiPurposeVersion4,
          ],
        })
      );

      mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

      const expectedM2MPurpose: m2mGatewayApi.Purpose = {
        consumerId: mockApiPurpose.data.consumerId,
        createdAt: mockApiPurpose.data.createdAt,
        description: mockApiPurpose.data.description,
        eserviceId: mockApiPurpose.data.eserviceId,
        id: mockApiPurpose.data.id,
        isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
        isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
        title: mockApiPurpose.data.title,
        delegationId: mockApiPurpose.data.delegationId,
        freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
        updatedAt: mockApiPurpose.data.updatedAt,
        currentVersion: mockApiPurposeVersion2,
        rejectedVersion: mockApiPurposeVersion4,
        waitingForApprovalVersion: mockApiPurposeVersion3,
      };

      const result = await purposeService.getPurpose(
        generateId(),
        getMockM2MAdminAppContext()
      );

      expect(result).toEqual(expectedM2MPurpose);
    }
  );

  it("should set waitingForApprovalVersion to the latest version with WAITING_FOR_APPROVAL state", async () => {
    const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL,
    });
    const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.ACTIVE,
    });
    const mockApiPurposeVersion3 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL,
    });
    const mockApiPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [
          mockApiPurposeVersion1,
          mockApiPurposeVersion2,
          mockApiPurposeVersion3,
        ],
      })
    );

    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      currentVersion: mockApiPurposeVersion2,
      waitingForApprovalVersion: mockApiPurposeVersion3,
    };

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
  });

  it("should set rejectedVersion to the latest version with REJECTED state if it is the most recent one", async () => {
    const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.REJECTED,
    });
    const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.ACTIVE,
    });
    const mockApiPurposeVersion3 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.REJECTED,
    });
    const mockApiPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [
          mockApiPurposeVersion1,
          mockApiPurposeVersion2,
          mockApiPurposeVersion3,
        ],
      })
    );

    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      currentVersion: mockApiPurposeVersion2,
      rejectedVersion: mockApiPurposeVersion3,
    };

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
  });

  it("should not set currentVersion if all versions are WAITING_FOR_APPROVAL or REJECTED", async () => {
    const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL,
    });
    const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.REJECTED,
    });
    const mockApiPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
      })
    );

    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      waitingForApprovalVersion: mockApiPurposeVersion1,
      rejectedVersion: mockApiPurposeVersion2,
    };

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
  });

  it("should not set waitingForApprovalVersion if no versions are WAITING_FOR_APPROVAL", async () => {
    const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.ACTIVE,
    });
    const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.REJECTED,
    });
    const mockApiPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
      })
    );

    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      currentVersion: mockApiPurposeVersion1,
      rejectedVersion: mockApiPurposeVersion2,
    };

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
  });

  it("should not set rejectedVersion if no versions are REJECTED", async () => {
    const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.ACTIVE,
    });
    const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL,
    });
    const mockApiPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
      })
    );

    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      currentVersion: mockApiPurposeVersion1,
      waitingForApprovalVersion: mockApiPurposeVersion2,
    };

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
  });

  it("should not set rejectedVersion if the latest rejected version is not the most recent version", async () => {
    const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.ACTIVE,
    });
    const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.REJECTED,
    });
    const mockApiPurposeVersion3 = getMockedApiPurposeVersion({
      state: purposeApi.PurposeVersionState.Enum.WAITING_FOR_APPROVAL,
    });
    const mockApiPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [
          mockApiPurposeVersion1,
          mockApiPurposeVersion2,
          mockApiPurposeVersion3,
        ],
      })
    );

    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      currentVersion: mockApiPurposeVersion1,
      waitingForApprovalVersion: mockApiPurposeVersion3,
    };

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurpose);
  });
});
