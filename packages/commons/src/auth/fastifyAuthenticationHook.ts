import { FastifyReply, FastifyRequest } from "fastify";
import {
  badBearerToken,
  makeApiProblemBuilder,
  missingHeader,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { fromAppContext } from "../context/context.js";
import { JWTConfig } from "../config/httpServiceConfig.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

const makeApiProblem = makeApiProblemBuilder({});

function jwtFromFastifyAuthHeader(
  request: FastifyRequest,
  logger: { warn: (msg: string) => void }
): string {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw missingHeader("Authorization");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    logger.warn(
      `Invalid authentication provided for this call ${request.method} ${request.url}`
    );
    throw badBearerToken;
  }

  return parts[1];
}

export function fastifyAuthenticationHook(
  config: JWTConfig
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const ctx = fromAppContext(request.ctx);

    try {
      const jwtToken = jwtFromFastifyAuthHeader(request, ctx.logger);
      const { decoded } = await verifyJwtToken(jwtToken, config, ctx.logger);

      // eslint-disable-next-line functional/immutable-data
      request.ctx.authData = readAuthDataFromJwtToken(decoded);
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with("tokenVerificationFailed", () => 401)
            .with("operationForbidden", () => 403)
            .with("missingHeader", "badBearerToken", "invalidClaim", () => 400)
            .otherwise(() => 500),
        ctx
      );
      return reply.status(problem.status).send(problem);
    }
  };
}
