import { ZodiosBodyByPath } from "@zodios/core";
import { Problem } from "pagopa-interop-models";
import { attributeRegistryApi } from "pagopa-interop-api-clients";

type Api = typeof attributeRegistryApi.attributeApi.api;

export type ApiBulkAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/bulk/attributes"
>;

export type ApiCertifiedAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/certifiedAttributes"
>;

export type ApiVerifiedAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/verifiedAttributes"
>;

export type ApiDeclaredAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/declaredAttributes"
>;

export type ApiInternalCertifiedAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/internal/certifiedAttributes"
>;

export type ApiInternalServerError = Problem & {
  status: 500;
};
