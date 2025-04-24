import * as m2mGatewayApi from "./generated/m2mGatewayApi.js";
import { QueryParametersByAlias } from "./utils.js";

type AgreementApi = typeof m2mGatewayApi.agreementsApi.api;
type EServiceApi = typeof m2mGatewayApi.eservicesApi.api;
type PurposeApi = typeof m2mGatewayApi.purposesApi.api;
type TenantApi = typeof m2mGatewayApi.tenantsApi.api;
type DelegationApi = typeof m2mGatewayApi.delegationsApi.api;
type EServiceTemplateApi = typeof m2mGatewayApi.eserviceTemplatesApi.api;

export type GetAgreementsQueryParams = QueryParametersByAlias<
  AgreementApi,
  "getAgreements"
>;

export type GetEServicesQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServices"
>;

export type GetEServiceDescriptorsQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServiceDescriptor"
>;

export type GetPurposesQueryParams = QueryParametersByAlias<
  PurposeApi,
  "getPurposes"
>;

export type GetPurposeVersionsQueryParams = QueryParametersByAlias<
  PurposeApi,
  "getPurposeVersions"
>;

export type GetTenantsQueryParams = QueryParametersByAlias<
  TenantApi,
  "getTenants"
>;

export type GetConsumerDelegationsQueryParams = QueryParametersByAlias<
  DelegationApi,
  "getConsumerDelegations"
>;

export type GetEServiceTemplateVersionsQueryParams = QueryParametersByAlias<
  EServiceTemplateApi,
  "getEServiceTemplateVersions"
>;

export * from "./generated/m2mGatewayApi.js";
