import { beforeEach, describe, expect, it, vi } from "vitest";
import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiPurpose,
  testToM2mGatewayApiPurposeVersion,
} from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  mockInteropBeClients,
  purposeService,
} from "../../integrationUtils.js";

describe("toM2MGatewayApiPurpose", () => {
  const mockGetPurpose = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockGetPurpose.mockClear();
  });

  it.each(
    m2mGatewayApiV3.PurposeVersionState.options.filter(
      (state) =>
        state !==
          m2mGatewayApiV3.PurposeVersionState.Enum.WAITING_FOR_APPROVAL &&
        state !== m2mGatewayApiV3.PurposeVersionState.Enum.REJECTED
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

      const purposeVersion2 = testToM2mGatewayApiPurposeVersion(
        mockApiPurposeVersion2
      );
      const purposeVersion4 = testToM2mGatewayApiPurposeVersion(
        mockApiPurposeVersion4
      );
      const purposeVersion3 = testToM2mGatewayApiPurposeVersion(
        mockApiPurposeVersion3
      );
      const expectedM2MPurpose = testToM2mGatewayApiPurpose(
        mockApiPurpose.data,
        {
          currentVersion: purposeVersion2,
          rejectedVersion: purposeVersion4,
          waitingForApprovalVersion: purposeVersion3,
        }
      );

      const result = await purposeService.getPurpose(
        generateId(),
        getMockM2MAdminAppContext()
      );

      expect(result).toStrictEqual(expectedM2MPurpose);
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

    const purposeVersion2 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion2
    );
    const purposeVersion3 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion3
    );
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {
      currentVersion: purposeVersion2,
      waitingForApprovalVersion: purposeVersion3,
      rejectedVersion: undefined,
    });

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
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

    const purposeVersion2 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion2
    );
    const purposeVersion3 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion3
    );
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {
      currentVersion: purposeVersion2,
      rejectedVersion: purposeVersion3,
      waitingForApprovalVersion: undefined,
    });

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
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

    const purposeVersion1 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion1
    );
    const purposeVersion2 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion2
    );
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {
      waitingForApprovalVersion: purposeVersion1,
      rejectedVersion: purposeVersion2,
      currentVersion: undefined,
    });

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
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

    const purposeVersion1 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion1
    );
    const purposeVersion2 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion2
    );
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {
      currentVersion: purposeVersion1,
      rejectedVersion: purposeVersion2,
      waitingForApprovalVersion: undefined,
    });

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
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

    const purposeVersion1 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion1
    );
    const purposeVersion2 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion2
    );
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {
      currentVersion: purposeVersion1,
      waitingForApprovalVersion: purposeVersion2,
      rejectedVersion: undefined,
    });

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
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

    const purposeVersion1 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion1
    );
    const purposeVersion3 = testToM2mGatewayApiPurposeVersion(
      mockApiPurposeVersion3
    );
    const expectedM2MPurpose = testToM2mGatewayApiPurpose(mockApiPurpose.data, {
      currentVersion: purposeVersion1,
      waitingForApprovalVersion: purposeVersion3,
      rejectedVersion: undefined,
    });

    const result = await purposeService.getPurpose(
      generateId(),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MPurpose);
  });
});
