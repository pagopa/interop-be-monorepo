import { constants } from "http2";
import { FastifyInstance } from "fastify";
import { CorrelationId, generateId, Problem } from "pagopa-interop-models";

// Not wrapped in fastify-plugin: this creates an encapsulated scope so that
// parent-level hooks (auth, featureFlag, etc.) added after this registration
// do not apply to the /status route.
export async function fastifyHealthRouter(app: FastifyInstance): Promise<void> {
  app.get("/status", async (_request, reply) => {
    const healthProblem: Problem = {
      type: "about:blank",
      correlationId: generateId<CorrelationId>(),
      status: constants.HTTP_STATUS_OK,
      title: "Service status OK",
    };

    return reply
      .type("application/problem+json")
      .status(200)
      .send(healthProblem);
  });
}
