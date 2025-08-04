import * as agreementApi from "./generated/agreementApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof agreementApi.agreementApi.api;

export type GetAgreementsQueryParams = QueryParametersByAlias<
  Api,
  "getAgreements"
>;

export * from "./generated/agreementApi.js";
