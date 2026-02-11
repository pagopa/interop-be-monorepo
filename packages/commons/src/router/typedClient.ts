import axios, { AxiosInstance } from "axios";
import { z, ZodType } from "zod";
import type {
  EndpointDefinition,
  EndpointParameter,
  ExtractPathParams,
  ExtractQueryParams,
  ExtractBody,
} from "./typedRouter.js";

// Detects whether any parameter of a given type exists in the parameter list.
// Uses Extract on the union directly — avoids the UnionToIntersection<never> = unknown pitfall.
type HasParamOfType<
  P extends ReadonlyArray<EndpointParameter>,
  T extends string
> = [Extract<P[number], { type: T }>] extends [never] ? false : true;

type ClientCallOptions<E extends EndpointDefinition> = {
  headers?: Record<string, unknown>;
} & (E["parameters"] extends ReadonlyArray<EndpointParameter>
  ? (HasParamOfType<E["parameters"], "Path"> extends true
      ? { params: ExtractPathParams<E["parameters"]> }
      : { params?: never }) &
      (HasParamOfType<E["parameters"], "Query"> extends true
        ? { queries: Partial<ExtractQueryParams<E["parameters"]>> }
        : { queries?: never }) &
      (HasParamOfType<E["parameters"], "Body"> extends true
        ? { body: ExtractBody<E["parameters"]> }
        : NonNullable<unknown>)
  : NonNullable<unknown>);

type TypedClient<Endpoints extends ReadonlyArray<EndpointDefinition>> = {
  [E in Endpoints[number] as E extends { alias: infer A extends string }
    ? A
    : never]: (
    options: ClientCallOptions<E>
  ) => Promise<
    E["response"] extends ZodType ? z.output<E["response"]> : unknown
  >;
} & { axios: AxiosInstance };

export function createTypedClient<
  const Endpoints extends ReadonlyArray<EndpointDefinition>
>(
  baseUrl: string,
  endpoints: Endpoints,
  options?: {
    paramsSerializer?: (params: Record<string, unknown>) => string;
  }
): TypedClient<Endpoints> {
  const instance = axios.create({
    baseURL: baseUrl,
    ...(options?.paramsSerializer && {
      paramsSerializer: options.paramsSerializer,
    }),
  });

  const client = {} as Record<string, unknown>;

  for (const endpoint of endpoints) {
    if (!endpoint.alias) {
      continue;
    }
    // eslint-disable-next-line functional/immutable-data
    client[endpoint.alias] = async (callOpts: {
      params?: Record<string, string>;
      queries?: Record<string, unknown>;
      body?: unknown;
      headers?: Record<
        string,
        string | string[] | number | boolean | null | undefined
      >;
    }): Promise<unknown> => {
      const url = callOpts.params
        ? Object.entries(callOpts.params).reduce(
            (acc, [key, value]) =>
              acc.replace(`:${key}`, encodeURIComponent(String(value))),
            endpoint.path
          )
        : endpoint.path;
      const { data } = await instance.request({
        method: endpoint.method,
        url,
        params: callOpts.queries,
        data: callOpts.body,
        headers: callOpts.headers,
      });
      return data;
    };
  }

  return { ...client, axios: instance } as TypedClient<Endpoints>;
}
