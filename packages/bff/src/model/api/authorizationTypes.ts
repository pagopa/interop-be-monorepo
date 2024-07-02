import { ZodiosResponseByPath } from "@zodios/core";
import { z } from "zod";
import {
  api as authorizationApi,
  schemas,
} from "../generated/authorization-process/api.js";

type AuthorizationApi = typeof authorizationApi.api;

export type ClientsWithKeysApiResponse = ZodiosResponseByPath<
  AuthorizationApi,
  "get",
  "/clientsWithKeys"
>;

export type AuthorizationProcessApiClientWithKeys = z.infer<
  typeof schemas.ClientWithKeys
>;
