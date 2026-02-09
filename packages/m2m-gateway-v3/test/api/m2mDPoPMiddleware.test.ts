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
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  PutItemCommandOutput,
  GetItemCommandOutput,
  AttributeValue,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import {
  APIEndpoint,
  RateLimiter,
  rateLimiterMiddleware,
} from "pagopa-interop-commons";
import {
  generateM2MAdminAccessTokenWithDPoPProof,
  JwksServer,
  startJwksServer,
} from "pagopa-interop-commons-test";
import { config } from "../../src/config/config.js";
import { authenticationDPoPMiddleware } from "../../src/utils/middlewares.js";

type Item = Record<string, AttributeValue>;

export function createInMemoryDynamoDBClient(): DynamoDBClient {
  const table = new Map<string, Item>();

  const send = vi.fn(async (command): Promise<unknown> => {
    // ---------------------------
    // PUT ITEM
    // ---------------------------
    if (command instanceof PutItemCommand) {
      const input = command.input;
      const jti = input.Item?.jti?.S;

      if (!jti) {
        throw new Error("Missing jti");
      }

      if (table.has(jti)) {
        throw new ConditionalCheckFailedException({
          message: "Conditional check failed",
          $metadata: {},
        });
      }

      if (!input.Item) {
        throw new Error("Missing item");
      }
      table.set(jti, input.Item);

      const output: PutItemCommandOutput = {
        $metadata: {},
      };
      return output;
    }

    // ---------------------------
    // GET ITEM
    // ---------------------------
    if (command instanceof GetItemCommand) {
      const jti = command.input.Key?.jti?.S;

      if (!jti) {
        throw new Error("Missing jti");
      }

      const item = table.get(jti);

      const output: GetItemCommandOutput = {
        Item: item,
        $metadata: {},
      };

      return output;
    }

    throw new Error(`Unsupported command: ${command.constructor.name}`);
  });

  return { send } as unknown as DynamoDBClient;
}

const dynamoClient = {
  send: vi.fn().mockResolvedValue({
    Item: undefined,
  }),
} as unknown as DynamoDBClient;

const inMemeryDynamoClient = createInMemoryDynamoDBClient();

export const mockRateLimiter: RateLimiter = {
  rateLimitByOrganization: vi.fn().mockResolvedValue({
    limitReached: false,
    maxRequests: 100,
    rateInterval: 1000,
    remainingRequests: 99,
  }),
  getCountByOrganization: vi.fn(),
  getBurstCountByOrganization: vi.fn(),
};

function buildTestApp(wellKnownUrl: string, useInMemoryDynamoClient = false) {
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
      useInMemoryDynamoClient ? inMemeryDynamoClient : dynamoClient
    ),
    rateLimiterMiddleware(mockRateLimiter)
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
  let mockDPoPData: Awaited<
    ReturnType<typeof generateM2MAdminAccessTokenWithDPoPProof>
  >;

  beforeAll(async () => {
    mockDPoPData = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/test`,
      htm: "GET",
    });
    jwksServer = await startJwksServer(mockDPoPData.authServerPublicJwk);
  });

  afterAll(async () => {
    await jwksServer.close();
  });

  beforeEach(() => {
    vi.unmock("../../src/utils/middlewares.js");
  });

  it("Should return 200 and call next when the token and the DPoP proof are valid", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body).toEqual({ authData: mockDPoPData.expectedAuthData });
    expect(res.status).toBe(200);
  });

  it("Should return 401 if the same token is used more than once", async () => {
    const app = buildTestApp(jwksServer.url, true);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body).toEqual({ authData: mockDPoPData.expectedAuthData });
    expect(res.status).toBe(200);

    const res2 = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res2.body.title).toEqual("DPoP proof JTI already in cache");
    expect(res2.status).toBe(401);
  });

  it("Should return 400 if the Authorization token is Bearer", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", "Bearer " + mockDPoPData.accessToken)
      .set("DPoP", mockDPoPData.dpopProof);

    expect(res.body.title).toEqual("Bad DPoP Token format");
    expect(res.status).toBe(400);
  });

  it("Should return 400 if DPoP proof is missing", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`);

    expect(res.body.title).toEqual("Header has not been passed");
    expect(res.status).toBe(400);
  });

  it("Should return 400 if DPoP proof is invalid for this token", async () => {
    const app = buildTestApp(jwksServer.url);
    const secondDPoPData = await generateM2MAdminAccessTokenWithDPoPProof({
      htu: `${config.dpopHtuBase}/test`,
      htm: "GET",
    });
    const secondDPoPProof = secondDPoPData.dpopProof;

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessToken}`)
      .set("DPoP", secondDPoPProof);

    expect(res.body.title).toEqual("DPoP Token Binding Mismatch");
    expect(res.status).toBe(401);
  });

  it("Should return 401 if cnf is missing", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessTokenWithoutCnf}`)
      .set("DPoP", `DPoP ${mockDPoPData.dpopProof}`);

    expect(res.body.title).toEqual("Token verification failed");
    expect(res.status).toBe(401);
  });

  it("Should return 401 if cnf is different", async () => {
    const app = buildTestApp(jwksServer.url);

    const res = await request(app)
      .get("/test")
      .set("Authorization", `DPoP ${mockDPoPData.accessTokenWithDifferentCnf}`)
      .set("DPoP", `DPoP ${mockDPoPData.dpopProof}`);

    expect(res.body.title).toEqual("DPoP proof validation failed");
    expect(res.status).toBe(401);
  });
});
