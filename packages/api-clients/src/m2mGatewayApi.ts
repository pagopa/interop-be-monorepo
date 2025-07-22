import * as m2mGatewayApi from "./generated/m2mGatewayApi.js";
import { QueryParametersByAlias } from "./utils.js";

type AgreementApi = typeof m2mGatewayApi.agreementsApi.api;
type AttributeApi = typeof m2mGatewayApi.attributesApi.api;
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

export type GetAgreementConsumerDocumentsQueryParams = QueryParametersByAlias<
  AgreementApi,
  "getAgreementConsumerDocuments"
>;

export type GetAgreementPurposesQueryParams = QueryParametersByAlias<
  AgreementApi,
  "getAgreementPurposes"
>;

export type GetCertifiedAttributesQueryParams = QueryParametersByAlias<
  AttributeApi,
  "getCertifiedAttributes"
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

export type GetTenantCertifiedAttributesQueryParams = QueryParametersByAlias<
  TenantApi,
  "getCertifiedAttributes"
>;

export type GetTenantVerifiedAttributesQueryParams = QueryParametersByAlias<
  TenantApi,
  "getVerifiedAttributes"
>;

export type GetTenantDeclaredAttributesQueryParams = QueryParametersByAlias<
  TenantApi,
  "getDeclaredAttributes"
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

export type GetClientPurposesQueryParams = QueryParametersByAlias<
  ClientApi,
  "getClientPurposes"
>;

export type GetClientKeysQueryParams = QueryParametersByAlias<
  ClientApi,
  "getClientKeys"
>;

export * from "./generated/m2mGatewayApi.js";
