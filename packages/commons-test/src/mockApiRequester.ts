/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from "crypto";
import { RequestListener } from "http";
import supertest from "supertest";
import type {
  Method,
  ZodiosEndpointDefinition,
  ZodiosPathsByMethod,
  ZodiosBodyByPath,
  ZodiosQueryParamsByPath,
  ZodiosPathParamsByPath,
  ZodiosResponseByPath,
} from "@zodios/core";

type MockedApiRequestOptions<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>,
  TMethod extends Method,
  TPath extends ZodiosPathsByMethod<TApi, TMethod>
> = {
  path: TPath;
} & (ZodiosPathParamsByPath<TApi, TMethod, TPath> extends never
  ? object
  : { pathParams: ZodiosPathParamsByPath<TApi, TMethod, TPath> }) &
  (ZodiosQueryParamsByPath<TApi, TMethod, TPath> extends never
    ? object
    : { queryParams: ZodiosQueryParamsByPath<TApi, TMethod, TPath> }) &
  (ZodiosBodyByPath<TApi, TMethod, TPath> extends never
    ? object
    : { body: ZodiosBodyByPath<TApi, TMethod, TPath> });

export function createMockedApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
>(app: RequestListener) {
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

  const requester = supertest(app);

  function sendMockedApiRequest<TMethod extends Method>(method: TMethod) {
    return async <TPath extends ZodiosPathsByMethod<TApi, TMethod>>(
      opts: MockedApiRequestOptions<TApi, TMethod, TPath>
    ) => {
      const { path, pathParams, body, queryParams } = opts as {
        path: string;
        pathParams?: Record<string, string>;
        body?: unknown;
        queryParams?: unknown;
      };
      const request = requester[method](resolvePathParams(path, pathParams));

      request.set({
        "X-Correlation-Id": randomUUID(),
        Authorization:
          "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCIsImtpZCI6IjE3YzExNzdmLWQ3ZGMtNDE4MS05ZjU0LTZmZDQxNmJmMjI5YiIsInVzZSI6InNpZyJ9.eyJleHRlcm5hbElkIjp7Im9yaWdpbiI6IklQQSIsInZhbHVlIjoiNU4yVFI1NTcifSwidXNlci1yb2xlcyI6ImFkbWluIiwic2VsZmNhcmVJZCI6IjE5NjJkMjFjLWM3MDEtNDgwNS05M2Y2LTUzYTg3Nzg5ODc1NiIsIm9yZ2FuaXphdGlvbklkIjoiNjllMjg2NWUtNjVhYi00ZTQ4LWE2MzgtMjAzN2E5ZWUyZWU3Iiwib3JnYW5pemF0aW9uIjp7ImlkIjoiMTk2MmQyMWMtYzcwMS00ODA1LTkzZjYtNTNhODc3ODk4NzU2IiwibmFtZSI6IlBhZ29QQSBTLnAuQS4iLCJyb2xlcyI6W3sicGFydHlSb2xlIjoiTUFOQUdFUiIsInJvbGUiOiJhZG1pbiJ9XSwiZmlzY2FsX2NvZGUiOiIxNTM3NjM3MTAwOSIsImlwYUNvZGUiOiI1TjJUUjU1NyJ9LCJ1aWQiOiJmMDdkZGI4Zi0xN2Y5LTQ3ZDQtYjMxZS0zNWQxYWMxMGU1MjEiLCJpc3MiOiJkZXYuaW50ZXJvcC5wYWdvcGEuaXQiLCJhdWQiOiJkZXYuaW50ZXJvcC5wYWdvcGEuaXQvdWkiLCJuYmYiOjE3MDg2OTA2NTcsImlhdCI6MTcwODY5MDY1NywiZXhwIjoxNzA4NzE5NDU3LCJqdGkiOiJhNjAxMDYyYS1kMTAzLTQ3YjAtODBiZi1jMTYxOTAzMjZkNzMifQ.",
      });

      if (queryParams) {
        request.query(queryParams);
      }
      if (body) {
        request.send(body);
      }

      type Response = Omit<supertest.Response, "body"> & {
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
  };
}

export type MockApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
> = ReturnType<typeof createMockedApiRequester<TApi>>;
