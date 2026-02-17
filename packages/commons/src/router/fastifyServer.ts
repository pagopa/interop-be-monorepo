import { FastifyInstance } from "fastify";
import { genericLogger } from "../logging/index.js";

export async function startFastifyServer(
  app: FastifyInstance,
  config: {
    host: string;
    port: number;
    keepAliveTimeout: number;
  }
): Promise<void> {
  await app.listen({ host: config.host, port: config.port });
  genericLogger.info(`Listening on ${config.host}:${config.port}`);

  // eslint-disable-next-line functional/immutable-data
  app.server.keepAliveTimeout = config.keepAliveTimeout;
}
