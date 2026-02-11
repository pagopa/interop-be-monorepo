import axios, { AxiosInstance } from "axios";
import { z, ZodType } from "zod";
import type { RouteDefinition } from "./typedRouter.js";

type ExtractResponseSchema<R> = R extends {
  responses: {
    200: {
      content: { "application/json": { schema: infer S extends ZodType } };
    };
  };
}
  ? z.output<S>
  : void;

type ExtractBodySchema<R> = R extends {
  request: {
    body: {
      content: { "application/json": { schema: infer S extends ZodType } };
    };
  };
}
  ? z.output<S>
  : never;

type ExtractParamsSchema<R> = R extends {
  request: { params: infer P extends z.AnyZodObject };
}
  ? z.output<P>
  : never;

type ExtractQuerySchema<R> = R extends {
  request: { query: infer Q extends z.AnyZodObject };
}
  ? z.output<Q>
  : never;

type HasField<R, Field extends string> = R extends {
  request: Record<Field, unknown>;
}
  ? true
  : false;

type HasBody<R> = R extends {
  request: { body: { content: { "application/json": { schema: ZodType } } } };
}
  ? true
  : false;

type ClientCallOptions<R> = {
  headers?: Record<string, unknown>;
} & (HasField<R, "params"> extends true
  ? { params: ExtractParamsSchema<R> }
  : { params?: never }) &
  (HasField<R, "query"> extends true
    ? { queries: Partial<ExtractQuerySchema<R>> }
    : { queries?: never }) &
  (HasBody<R> extends true
    ? { body: ExtractBodySchema<R> }
    : NonNullable<unknown>);

type TypedClient<Routes extends ReadonlyArray<RouteDefinition>> = {
  [R in Routes[number] as R extends { operationId: infer O extends string }
    ? O
    : never]: (
    options: ClientCallOptions<R>
  ) => Promise<ExtractResponseSchema<R>>;
} & { axios: AxiosInstance };

export function createTypedClient<
  const Routes extends ReadonlyArray<RouteDefinition>
>(
  baseUrl: string,
  routes: Routes,
  options?: {
    paramsSerializer?: (params: Record<string, unknown>) => string;
  }
): TypedClient<Routes> {
  const instance = axios.create({
    baseURL: baseUrl,
    ...(options?.paramsSerializer && {
      paramsSerializer: options.paramsSerializer,
    }),
  });

  const client = {} as Record<string, unknown>;

  for (const route of routes) {
    // eslint-disable-next-line functional/immutable-data
    client[route.operationId] = async (callOpts: {
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
              acc.replace(`{${key}}`, encodeURIComponent(String(value))),
            route.path
          )
        : route.path;
      const { data } = await instance.request({
        method: route.method,
        url,
        params: callOpts.queries,
        data: callOpts.body,
        headers: callOpts.headers,
      });
      return data;
    };
  }

  return { ...client, axios: instance } as TypedClient<Routes>;
}
