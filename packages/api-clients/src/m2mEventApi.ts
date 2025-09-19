import * as m2mEventApi from "./generated/m2mEventApi.js";
import { QueryParametersByAlias } from "./utils.js";

type M2MEventsAPI = typeof m2mEventApi.m2mEventsApi.api;

export type GetAttributeM2MEventsQueryParams = QueryParametersByAlias<
  M2MEventsAPI,
  "getAttributeM2MEvents"
>;

export * from "./generated/m2mEventApi.js";
