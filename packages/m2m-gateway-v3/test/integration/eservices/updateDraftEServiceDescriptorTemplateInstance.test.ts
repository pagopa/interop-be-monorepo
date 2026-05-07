import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftEServiceDescriptorTemplateInstance", () => {
  const mockAttributeId = generateId();
  const mockDescriptor = getMockedApiEserviceDescriptor({
    state: catalogApi.EServiceDescriptorState.Values.DRAFT,
  });
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor],
  });
  const mockSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed = {
    audience: ["https://api.example.test"],
    dailyCallsPerConsumer: 100,
    dailyCallsTotal: 1000,
    agreementApprovalPolicy: "AUTOMATIC",
    attributes: {
      certified: [
        [
          {
            id: mockAttributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 500,
          },
        ],
      ],
      declared: [],
      verified: [],
    },
  };
  const mockUpdateDraftDescriptorTemplateInstance = vi
    .fn()
    .mockResolvedValue({ data: mockEService });

  mockInteropBeClients.catalogProcessClient = {
    updateDraftDescriptorTemplateInstance:
      mockUpdateDraftDescriptorTemplateInstance,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockUpdateDraftDescriptorTemplateInstance.mockClear();
  });

  it("Should update draft template instance descriptor and return the e-service id", async () => {
    const result =
      await eserviceService.updateDraftEServiceDescriptorTemplateInstance(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      );

    const expectedResource: m2mGatewayApiV3.CreatedResource = {
      id: mockEService.id,
    };

    expect(result).toStrictEqual(expectedResource);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .updateDraftDescriptorTemplateInstance,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
      body: mockSeed,
    });
  });
});
