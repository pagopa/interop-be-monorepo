import { FastifyReply, FastifyRequest } from "fastify";
import { getUserInfoFromAuthData } from "../auth/authData.js";
import { LoggerMetadata, logger } from "../logging/index.js";

export function fastifyLoggerHook(
  serviceName: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const context = request.ctx;

    const { userId, organizationId } = getUserInfoFromAuthData(
      context?.authData
    );

    const loggerMetadata: LoggerMetadata = {
      serviceName,
      userId,
      organizationId,
      correlationId: context?.correlationId,
      jti: context?.authData?.jti,
    };

    const loggerInstance = logger(loggerMetadata);
    const msg = `Request ${request.method} ${request.url} - Response ${reply.statusCode}`;
    if (request.url === "/status") {
      loggerInstance.debug(msg);
    } else {
      loggerInstance.info(msg);
    }
  };
}
