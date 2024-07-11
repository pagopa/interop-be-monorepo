import * as apiGatewayApi from "./generated/apiGatewayApi.js";
import { QueryParametersByAlias } from "./utils.js";

type ApiGatewayApi = typeof apiGatewayApi.gatewayApi.api;

export type GetAgreementQueryParam = QueryParametersByAlias<
  ApiGatewayApi,
  "getAgreement"
>;
// TODO ^ why is this not working?

export * from "./generated/apiGatewayApi.js";
