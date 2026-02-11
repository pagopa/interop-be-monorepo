import { constants } from "http2";
import { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import {
  CorrelationId,
  generateId,
  makeApiProblemBuilder,
  missingHeader,
  SpanId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { genericLogger } from "../logging/index.js";
import { AppContext } from "./context.js";

declare module "fastify" {
  interface FastifyRequest {
    ctx: AppContext;
  }
}

const makeApiProblem = makeApiProblemBuilder({});

function parseCorrelationIdHeader(req: FastifyRequest): string | undefined {
  const header = req.headers["x-correlation-id"];
  return typeof header === "string" ? header : undefined;
}

export const fastifyContextPlugin = fp(
  async (
    app: FastifyInstance,
    opts: { serviceName: string; readCorrelationIdFromHeader?: boolean }
  ) => {
    const { serviceName, readCorrelationIdFromHeader = true } = opts;

    // Fastify 5 requires getter/setter for reference-type decorators to avoid
    // sharing object state across requests.
    const ctxStore = new WeakMap<FastifyRequest, AppContext>();
    app.decorateRequest("ctx", {
      getter(this: FastifyRequest) {
        return ctxStore.get(this)!;
      },
      setter(this: FastifyRequest, value: AppContext) {
        ctxStore.set(this, value);
      },
    });

    app.addHook("onRequest", async (request, reply) => {
      if (readCorrelationIdFromHeader) {
        const correlationIdHeader = parseCorrelationIdHeader(request);

        if (!correlationIdHeader) {
          const problem = makeApiProblem(
            missingHeader("X-Correlation-Id"),
            () => constants.HTTP_STATUS_BAD_REQUEST,
            {
              logger: genericLogger,
              correlationId: unsafeBrandId("MISSING"),
              serviceName,
            }
          );
          return reply.status(problem.status).send(problem);
        }

        // eslint-disable-next-line functional/immutable-data
        request.ctx = {
          serviceName,
          correlationId: unsafeBrandId<CorrelationId>(correlationIdHeader),
          spanId: generateId<SpanId>(),
        } as AppContext;

        await reply.header("X-Correlation-Id", correlationIdHeader);
      } else {
        const correlationId = generateId<CorrelationId>();

        // eslint-disable-next-line functional/immutable-data
        request.ctx = {
          serviceName,
          correlationId,
          spanId: generateId<SpanId>(),
        } as AppContext;

        await reply.header("X-Correlation-Id", correlationId);
      }
    });
  },
  { name: "fastify-context" }
);
