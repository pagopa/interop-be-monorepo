/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from "crypto";
import { RequestListener } from "http";
import jwt from "jsonwebtoken";
import request from "supertest";
import type {
  Method,
  ZodiosEndpointDefinition,
  ZodiosPathsByMethod,
  ZodiosBodyByPath,
  ZodiosQueryParamsByPath,
  ZodiosPathParamsByPath,
  ZodiosResponseByPath,
} from "@zodios/core";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData } from "./testUtils.js";

type MockedApiRequestOptions<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>,
  TMethod extends Method,
  TPath extends ZodiosPathsByMethod<TApi, TMethod>
> = {
  path: TPath;
  authData?: AuthData;
} & (ZodiosPathParamsByPath<TApi, TMethod, TPath> extends never
  ? object
  : { pathParams: ZodiosPathParamsByPath<TApi, TMethod, TPath> }) &
  (ZodiosQueryParamsByPath<TApi, TMethod, TPath> extends never
    ? object
    : { queryParams: ZodiosQueryParamsByPath<TApi, TMethod, TPath> }) &
  (ZodiosBodyByPath<TApi, TMethod, TPath> extends never
    ? object
    : { body: ZodiosBodyByPath<TApi, TMethod, TPath> });

type MockedApiRequester<TApi extends Array<ZodiosEndpointDefinition<unknown>>> =
  {
    [TMethod in "get" | "post" | "delete" | "put"]: <
      TPath extends ZodiosPathsByMethod<TApi, TMethod>
    >(
      opts: MockedApiRequestOptions<TApi, TMethod, TPath>
    ) => Promise<ZodiosResponseByPath<TApi, TMethod, TPath>>;
  };

export function createMockedApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
>(app: RequestListener): MockedApiRequester<TApi> {
  function resolvePathParams(
    path: string,
    pathParams?: Record<string, string>
  ) {
    if (!pathParams) {
      return path;
    }
    return Object.entries(pathParams).reduce(
      (acc, [key, value]) => acc.replace(`:${key}`, value),
      path
    );
  }

  const requester = request(app);

  function sendMockedApiRequest<TMethod extends Method>(method: TMethod) {
    return async <TPath extends ZodiosPathsByMethod<TApi, TMethod>>(
      opts: MockedApiRequestOptions<TApi, TMethod, TPath>
    ): Promise<ZodiosResponseByPath<TApi, TMethod, TPath>> => {
      const authData = opts.authData ?? getMockAuthData();
      const { path, pathParams, body, queryParams } = opts as {
        path: string;
        pathParams?: Record<string, string>;
        body?: unknown;
        queryParams?: unknown;
      };
      const request = requester[method](resolvePathParams(path, pathParams));

      const mockedJwt = jwt.sign({}, null, {
        header: { alg: "none", typ: "JWT", ...authData },
        algorithm: "none",
      });

      request.set({
        "X-Correlation-Id": randomUUID(),
        Authorization: `Bearer ${mockedJwt}`,
      });

      if (queryParams) {
        request.query(queryParams);
      }
      if (body) {
        request.send(body);
      }

      type Response = Omit<request.Response, "body"> & {
        body: ZodiosResponseByPath<TApi, TMethod, TPath>;
      };

      return new Promise<Response>((resolve, reject) => {
        request.end((err, res) => {
          if (err) {
            reject(err);
          }
          resolve(res);
        });
      });
    };
  }

  return {
    get: sendMockedApiRequest("get"),
    post: sendMockedApiRequest("post"),
    delete: sendMockedApiRequest("delete"),
    put: sendMockedApiRequest("put"),
  };
}

export type MockApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
> = ReturnType<typeof createMockedApiRequester<TApi>>;
