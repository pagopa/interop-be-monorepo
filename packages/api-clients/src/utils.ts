import {
  ZodiosEndpointDefinition,
  ZodiosEndpointParameter,
} from "@zodios/core";
import { ZodType, z } from "zod";

type MakeUndefinedOptional<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

type QueryParameters<T extends ZodiosEndpointParameter[]> = {
  [K in T[number] as K["type"] extends "Query"
    ? K["name"]
    : never]: K["schema"] extends ZodType ? z.infer<K["schema"]> : never;
};

// Similar to ZodiosQueryParamsByAlias but resolve an issue with array types inference
export type QueryParametersByAlias<
  T extends ZodiosEndpointDefinition[],
  K extends T[number]["alias"]
> = T[number] extends infer U
  ? U extends { alias: K; parameters: ZodiosEndpointParameter[] }
    ? MakeUndefinedOptional<QueryParameters<U["parameters"]>>
    : never
  : never;
