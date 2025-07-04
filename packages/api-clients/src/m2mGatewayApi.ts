import * as m2mGatewayApi from "./generated/m2mGatewayApi.js";
import { QueryParametersByAlias } from "./utils.js";

type AgreementApi = typeof m2mGatewayApi.agreementsApi.api;
type EServiceApi = typeof m2mGatewayApi.eservicesApi.api;
type PurposeApi = typeof m2mGatewayApi.purposesApi.api;
type TenantApi = typeof m2mGatewayApi.tenantsApi.api;
type DelegationApi = typeof m2mGatewayApi.delegationsApi.api;
type EServiceTemplateApi = typeof m2mGatewayApi.eserviceTemplatesApi.api;
type ClientApi = typeof m2mGatewayApi.clientsApi.api;

export type GetAgreementsQueryParams = QueryParametersByAlias<
  AgreementApi,
  "getAgreements"
>;

export type GetAgreementPurposesQueryParams = QueryParametersByAlias<
  AgreementApi,
  "getAgreementPurposes"
>;

export type GetEServicesQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServices"
>;

export type GetEServiceDescriptorsQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServiceDescriptors"
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

export type GetCertifiedAttributesQueryParams = QueryParametersByAlias<
  TenantApi,
  "getCertifiedAttributes"
>;

export type GetConsumerDelegationsQueryParams = QueryParametersByAlias<
  DelegationApi,
  "getConsumerDelegations"
>;

export type GetProducerDelegationsQueryParams = QueryParametersByAlias<
  DelegationApi,
  "getProducerDelegations"
>;

export type GetEServiceTemplateVersionsQueryParams = QueryParametersByAlias<
  EServiceTemplateApi,
  "getEServiceTemplateVersions"
>;

export type GetClientsQueryParams = QueryParametersByAlias<
  ClientApi,
  "getClients"
>;

export * from "./generated/m2mGatewayApi.js";
