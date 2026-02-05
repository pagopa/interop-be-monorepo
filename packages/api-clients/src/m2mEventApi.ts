import * as m2mEventApi from "./generated/m2mEventApi.js";
import { QueryParametersByAlias } from "./utils.js";

type M2MEventsAPI = typeof m2mEventApi.m2mEventsApi.api;

export type EventManagerClient = ReturnType<
  typeof m2mEventApi.createM2mEventsApiClient
>;

export type GetAttributeM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getAttributeM2MEvents"
>;

export type GetEServiceM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getEServiceM2MEvents"
>;

export type GetAgreementM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getAgreementM2MEvents"
>;

export type GetPurposeM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getPurposeM2MEvents"
>;

export type GetTenantM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getTenantM2MEvents"
>;

export type GetProducerDelegationM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getProducerDelegationM2MEvents"
>;

export type GetConsumerDelegationM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getConsumerDelegationM2MEvents"
>;

export type GetKeyM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getKeyM2MEvents"
>;

export type GetClientM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getClientM2MEvents"
>;

export type GetProducerKeychainM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getProducerKeychainM2MEvents"
>;

export type GetProducerKeyM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getProducerKeyM2MEvents"
>;

export type GetEServiceTemplateM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getEServiceTemplateM2MEvents"
>;

export * from "./generated/m2mEventApi.js";
