import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import {
  fastifyContextPlugin,
  fastifyAuthenticationHook,
  fastifyLoggerHook,
  fastifyHealthRouter,
  fastifyErrorHandler,
} from "pagopa-interop-commons";
import {
  fastifyApplicationAuditBeginHook,
  fastifyApplicationAuditEndHook,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import notificationConfigRouter from "./routers/NotificationConfigRouter.js";
import { config } from "./config/config.js";
import { NotificationConfigService } from "./services/notificationConfigService.js";
import { notificationConfigFeatureFlagHook } from "./utilities/middlewares.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(service: NotificationConfigService) {
  const serviceName = modelsServiceName.NOTIFICATION_CONFIG_PROCESS;

  const app = Fastify();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler(fastifyErrorHandler);

  // Health router — separate encapsulated scope, no auth/context hooks
  await app.register(fastifyHealthRouter);

  // Authenticated scope — all hooks and business routes go here
  // so they don't affect the health route above
  await app.register(async (scope) => {
    // Feature flag hook — applies to all authenticated routes
    scope.addHook("onRequest", notificationConfigFeatureFlagHook);

    // Context plugin — parses X-Correlation-Id, generates spanId
    await scope.register(fastifyContextPlugin, { serviceName });

    // Audit begin hook — runs after context is set
    const auditBeginHook = await fastifyApplicationAuditBeginHook(
      serviceName,
      config
    );
    scope.addHook("onRequest", auditBeginHook);

    // Authentication hook
    scope.addHook("onRequest", fastifyAuthenticationHook(config));

    // Logger hook — runs on response
    scope.addHook("onResponse", fastifyLoggerHook(serviceName));

    // Audit end hook — runs on response
    const auditEndHook = await fastifyApplicationAuditEndHook(
      serviceName,
      config
    );
    scope.addHook("onResponse", auditEndHook);

    // Business routes
    await scope.register(notificationConfigRouter(service));
  });

  return app;
}
