import * as agreementApi from "./generated/agreementApi.js";
import { QueryParametersByAlias } from "./utils.js";

type AgreementApi = typeof agreementApi.agreementApi.api;

export type GetAgreementByIdQueryParam = QueryParametersByAlias<
  AgreementApi,
  "getAgreementById"
>;
// TODO ^ why is this not working?

export * from "./generated/agreementApi.js";
