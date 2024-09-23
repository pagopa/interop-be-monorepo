import * as apiGatewayApi from "./generated/apiGatewayApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof apiGatewayApi.gatewayApi.api;

export type GetAgreementsQueryParams = QueryParametersByAlias<
  Api,
  "getAgreements"
>;

export type GetPurposesQueryParams = QueryParametersByAlias<Api, "getPurposes">;

export type GetEServicesQueryParams = QueryParametersByAlias<
  Api,
  "getEServices"
>;

export * from "./generated/apiGatewayApi.js";
