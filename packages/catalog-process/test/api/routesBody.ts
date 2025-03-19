import { catalogApi } from "pagopa-interop-api-clients";
import { EService, tenantKind } from "pagopa-interop-models";
import { getMockValidRiskAnalysis } from "pagopa-interop-commons-test/index.js";
import { EServiceSeed } from "../../../api-clients/dist/catalogApi.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { getMockEService, getMockDescriptor } from "../mockUtils.js";
import { ApiGetEServicesFilters } from "../../src/model/domain/models.js";

export const mockEService: EService = {
  ...getMockEService(),
  descriptors: [getMockDescriptor()],
  riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
};

export const mockApiEservice: catalogApi.EService =
  eServiceToApiEService(mockEService);

export const mockEserviceSeed: EServiceSeed = {
  name: mockApiEservice.name,
  description: mockApiEservice.description,
  technology: "REST",
  mode: "RECEIVE",
  descriptor: {
    audience: mockApiEservice.descriptors[0].audience,
    voucherLifespan: mockApiEservice.descriptors[0].voucherLifespan,
    dailyCallsPerConsumer: mockApiEservice.descriptors[0].dailyCallsPerConsumer,
    dailyCallsTotal: mockApiEservice.descriptors[0].dailyCallsTotal,
    agreementApprovalPolicy:
      mockApiEservice.descriptors[0].agreementApprovalPolicy,
  },
};

export const mockEServicesResponse = {
  results: [
    {
      ...getMockEService(),
      descriptors: [getMockDescriptor()],
      riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
    },
    {
      ...getMockEService(),
      descriptors: [getMockDescriptor()],
      riskAnalysis: [getMockValidRiskAnalysis(tenantKind.PA)],
    },
  ],
  totalCount: 2,
};

export const mockEserviceFilter: ApiGetEServicesFilters = {
  eservicesIds: [],
  producersIds: [],
  attributesIds: [],
  states: [],
  agreementStates: [],
  templatesIds: [],
};

export const mockApiEServicesResponse = {
  ...mockEServicesResponse,
  results: mockEServicesResponse.results.map(eServiceToApiEService),
};
