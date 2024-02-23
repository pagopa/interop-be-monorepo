/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from "crypto";
import { RequestListener } from "http";
import supertest from "supertest";
import { afterAll, afterEach, describe, it, vi } from "vitest";
import {
  Method,
  ZodiosEndpointDefinition,
  ZodiosPathsByMethod,
  ZodiosBodyByPath,
  ZodiosQueryParamsByPath,
  ZodiosPathParamsByPath,
  ZodiosResponseByPath,
} from "@zodios/core";
import {
  postgreSQLContainer,
  mongoDBContainer,
  minioContainer,
  TEST_POSTGRES_DB_PORT,
  TEST_MONGO_DB_PORT,
  TEST_MINIO_PORT,
} from "pagopa-interop-commons-test/index.js";
import { config } from "../src/utilities/config.js";
import { api } from "../src/model/generated/api.js";

type Api = typeof api.api;

function createMockedApiRequester<
  TApi extends Array<ZodiosEndpointDefinition<unknown>>
>(app: RequestListener) {
  type MockedApiRequestOptions<
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

  function sendMockedApiRequest<TMethod extends Method>(method: TMethod) {
    return async <TPath extends ZodiosPathsByMethod<TApi, TMethod>>(
      opts: MockedApiRequestOptions<TMethod, TPath>
    ) => {
      const { path, pathParams, body, queryParams } = opts as {
        path: string;
        pathParams?: Record<string, string>;
        body?: unknown;
        queryParams?: unknown;
      };
      const request = supertest(app)[method](
        resolvePathParams(path, pathParams)
      );

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
const startedPostgreSqlContainer = await postgreSQLContainer(config).start();
const startedMongodbContainer = await mongoDBContainer(config).start();
const startedMinioContainer = await minioContainer(config).start();

vi.doMock("../src/utilities/config.js", () => ({
  config: {
    ...config,
    eventStoreDbPort: startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    ),
    readModelDbPort: startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT),
    s3ServerPort: startedMinioContainer.getMappedPort(TEST_MINIO_PORT),
  },
}));

const { default: app } = await import("../src/app.js");
const apiRequester = createMockedApiRequester<Api>(app);

describe("database test", () => {
  afterEach(async () => {
    // await eservices.deleteMany({});
    // await agreements.deleteMany({});
    // await tenants.deleteMany({});
    // await attributes.deleteMany({});
    // await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
    // await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
    await startedMinioContainer.stop();
  });

  it("/eservices", async () => {
    const response = await apiRequester.get({
      path: "/eservices",
      queryParams: { offset: 0, limit: 10 },
      // pathParams: { eServiceId: "1", descriptorId: "2" },
    });
    console.log(response.body);
  });
});
