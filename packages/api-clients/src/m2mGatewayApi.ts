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
type ProducerKeychainApi = typeof m2mGatewayApi.producerKeychainsApi.api;
type EventManagerApi = typeof m2mGatewayApi.eventsApi.api;
type PurposeTemplateApi = typeof m2mGatewayApi.purposeTemplatesApi.api;

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
export type GetDeclaredAttributesQueryParams = QueryParametersByAlias<
  AttributeApi,
  "getDeclaredAttributes"
>;
export type GetVerifiedAttributesQueryParams = QueryParametersByAlias<
  AttributeApi,
  "getVerifiedAttributes"
>;

export type GetEServicesQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServices"
>;

export type GetEServiceDescriptorsQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServiceDescriptors"
>;

export type GetEServiceDescriptorDocumentsQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServiceDescriptorDocuments"
>;

export type GetEServiceRiskAnalysesQueryParams = QueryParametersByAlias<
  EServiceApi,
  "getEServiceRiskAnalyses"
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
  "getTenantCertifiedAttributes"
>;

export type GetTenantVerifiedAttributesQueryParams = QueryParametersByAlias<
  TenantApi,
  "getTenantVerifiedAttributes"
>;
export type GetTenantVerifiedAttributeVerifiersQueryParams =
  QueryParametersByAlias<TenantApi, "getTenantVerifiedAttributeVerifiers">;
export type GetTenantVerifiedAttributeRevokersQueryParams =
  QueryParametersByAlias<TenantApi, "getTenantVerifiedAttributeRevokers">;

export type GetTenantDeclaredAttributesQueryParams = QueryParametersByAlias<
  TenantApi,
  "getTenantDeclaredAttributes"
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

export type GetEServiceTemplateRiskAnalysesQueryParams = QueryParametersByAlias<
  EServiceTemplateApi,
  "getEServiceTemplateRiskAnalyses"
>;

export type GetEServiceTemplatesQueryParams = QueryParametersByAlias<
  EServiceTemplateApi,
  "getEServiceTemplates"
>;

export type GetEServiceTemplateVersionDocumentsQueryParams =
  QueryParametersByAlias<
    EServiceTemplateApi,
    "getEServiceTemplateVersionDocuments"
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

export type GetProducerKeychainsQueryParams = QueryParametersByAlias<
  ProducerKeychainApi,
  "getProducerKeychains"
>;

export type GetProducerKeychainEServicesQueryParams = QueryParametersByAlias<
  ProducerKeychainApi,
  "getProducerKeychainEServices"
>;

export type GetProducerKeychainKeysQueryParams = QueryParametersByAlias<
  ProducerKeychainApi,
  "getProducerKeychainKeys"
>;

export type GetEServiceCertifiedAttributesQueryParams = QueryParametersByAlias<
  AttributeApi,
  "getCertifiedAttributes"
>;

export type GetEServiceTemplateVersionCertifiedAttributesQueryParams =
  QueryParametersByAlias<
    EServiceTemplateApi,
    "getEServiceTemplateVersionCertifiedAttributes"
  >;

export type GetEServiceTemplateVersionDeclaredAttributesQueryParams =
  QueryParametersByAlias<
    EServiceTemplateApi,
    "getEServiceTemplateVersionDeclaredAttributes"
  >;

export type GetEServiceTemplateVersionVerifiedAttributesQueryParams =
  QueryParametersByAlias<
    EServiceTemplateApi,
    "getEServiceTemplateVersionVerifiedAttributes"
  >;

export type GetEventManagerAttributesQueryParams = QueryParametersByAlias<
  EventManagerApi,
  "getAttributesEvents"
>;
export type GetEventManagerAgreementsQueryParams = QueryParametersByAlias<
  EventManagerApi,
  "getAgreementsEvents"
>;
export type GetEventManagerEServicesQueryParams = QueryParametersByAlias<
  EventManagerApi,
  "getEServicesEvents"
>;

export type GetPurposeTemplatesQueryParams = QueryParametersByAlias<
  PurposeTemplateApi,
  "getPurposeTemplates"
>;

export type GetPurposeTemplateEServicesQueryParams = QueryParametersByAlias<
  PurposeTemplateApi,
  "getPurposeTemplateEServices"
>;

export type GetRiskAnalysisTemplateAnnotationDocumentsQueryParams =
  QueryParametersByAlias<
    PurposeTemplateApi,
    "getRiskAnalysisTemplateAnnotationDocuments"
  >;

export type GetEventManagerEServiceTemplatesQueryParams =
  QueryParametersByAlias<EventManagerApi, "getEServiceTemplateEvents">;

export type GetEventManagerKeysQueryParams = QueryParametersByAlias<
  EventManagerApi,
  "getKeyEvents"
>;

export type GetEventManagerClientQueryParams = QueryParametersByAlias<
  EventManagerApi,
  "getClientEvents"
>;

export type GetEventManagerProducerKeyEventsQueryParams =
  QueryParametersByAlias<EventManagerApi, "getProducerKeyEvents">;

export type GetEventManagerProducerKeychainEventsQueryParams =
  QueryParametersByAlias<EventManagerApi, "getProducerKeychainEvents">;

export * from "./generated/m2mGatewayApi.js";
