import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiPurposeTemplateTargetTenantKind } from "../../../src/api/purposeTemplateApiConverter.js";

describe("getPurposeTemplate", () => {
  const mockApiPurposeTemplateResponse = getMockWithMetadata(
    getMockedApiPurposeTemplate()
  );

  const mockGetPurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockApiPurposeTemplateResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MPurposeTemplate: m2mGatewayApi.PurposeTemplate = {
      id: mockApiPurposeTemplateResponse.data.id,
      createdAt: mockApiPurposeTemplateResponse.data.createdAt,
      state: mockApiPurposeTemplateResponse.data.state,
      purposeTitle: mockApiPurposeTemplateResponse.data.purposeTitle,
      targetDescription: mockApiPurposeTemplateResponse.data.targetDescription,
      targetTenantKind: toM2MGatewayApiPurposeTemplateTargetTenantKind(
        mockApiPurposeTemplateResponse.data.targetTenantKind
      ),
      purposeDescription:
        mockApiPurposeTemplateResponse.data.purposeDescription,
      purposeIsFreeOfCharge:
        mockApiPurposeTemplateResponse.data.purposeIsFreeOfCharge,
      handlesPersonalData:
        mockApiPurposeTemplateResponse.data.handlesPersonalData,
      creatorId: mockApiPurposeTemplateResponse.data.creatorId,
      updatedAt: mockApiPurposeTemplateResponse.data.updatedAt,
      purposeFreeOfChargeReason:
        mockApiPurposeTemplateResponse.data.purposeFreeOfChargeReason,
      purposeDailyCalls: mockApiPurposeTemplateResponse.data.purposeDailyCalls,
    };

    const result = await purposeTemplateService.getPurposeTemplate(
      unsafeBrandId(expectedM2MPurposeTemplate.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MPurposeTemplate);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: {
        id: expectedM2MPurposeTemplate.id,
      },
    });
  });
});
