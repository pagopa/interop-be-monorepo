import * as agreementApi from "./generated/agreementApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof agreementApi.agreementApi.api;

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type GetAgreementsQueryParams = QueryParametersByAlias<
  Api,
  "getAgreements"
>;

export type GetAgreementConsumerDocumentsQueryParams = QueryParametersByAlias<
  Api,
  "getAgreementConsumerDocuments"
>;

export * from "./generated/agreementApi.js";
