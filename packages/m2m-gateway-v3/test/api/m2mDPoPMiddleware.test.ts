import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import express, { Request, Response } from "express";
import request from "supertest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIEndpoint } from "pagopa-interop-commons";
import {
  generateM2MAdminAccessTokenWithDPoPProof,
  JwksServer,
  startJwksServer,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { authenticationDPoPMiddleware } from "../../src/utils/middlewares.js";

const dynamoClient = {
  send: vi.fn().mockResolvedValue({
    Item: undefined,
  }),
} as unknown as DynamoDBClient;

function buildTestApp(wellKnownUrl: string) {
  const app = express();

  // minimal ctx bootstrap middleware
  app.use((req: Request & { ctx?: unknown }, _res, next) => {
    req.ctx = {
      correlationId: "test",
      serviceName: "test",
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    };
    next();
  });

  app.use(
    authenticationDPoPMiddleware(
      { ...config, wellKnownUrls: [APIEndpoint.parse(wellKnownUrl)] },
      dynamoClient
    )
  );

  type RequestWithCtx = Request & {
    ctx?: {
      authData?: unknown;
    };
  };

  app.get("/test", (req: RequestWithCtx, res: Response) => {
    try {
      res.status(200).json({ authData: req.ctx?.authData });
    } catch (error) {
      res.status(500).json({ error });
    }
  });

  return app;
}

describe("authenticationDPoPMiddleware", () => {
  let jwksServer: JwksServer;
  let data: Awaited<
    ReturnType<typeof generateM2MAdminAccessTokenWithDPoPProof>
  >;

  beforeAll(async () => {
    data = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/test`,
      htm: "GET",
    });
    jwksServer = await startJwksServer(data.authServerPublicJwk);
  });

  afterAll(async () => {
    await jwksServer.close();
  });

  beforeEach(() => {
    vi.unmock("../../src/utils/middlewares.js");
  });

  it.only("Should return 200 and call next when the token and the DPoP proof are valid", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${data.accessToken}`)
      .set("DPoP", data.dpopProof);

    expect(res.body).toEqual({ authData: data.expectedAuthData });
    expect(res.status).toBe(200);
  });
});
