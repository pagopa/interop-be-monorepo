import type { FastifyInstance, RouteHandlerMethod } from "fastify";
import { z } from "zod";

export interface RouteSchemas {
  body?: z.AnyZodObject;
  params?: z.ZodTypeAny;
  querystring?: z.ZodTypeAny;
}

export interface RouteDefinition {
  method: "get" | "post" | "put" | "patch" | "delete";
  url: string;
  schemas?: RouteSchemas;
}

export function registerRoutes(
  app: FastifyInstance,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlers: Record<string, (...args: any[]) => any>,
  manifest: Record<string, RouteDefinition>
): void {
  for (const [operationId, handler] of Object.entries(handlers)) {
    const route = manifest[operationId];
    if (!route) {
      throw new Error(
        `No route definition found for operation "${operationId}"`
      );
    }

    const url = route.url.replace(/\{(\w+)\}/g, ":$1");

    const schema = {
      ...(route.schemas?.body ? { body: route.schemas.body.strict() } : {}),
      ...(route.schemas?.params ? { params: route.schemas.params } : {}),
      ...(route.schemas?.querystring
        ? { querystring: route.schemas.querystring }
        : {}),
    };

    app.route({
      method: route.method.toUpperCase() as
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE",
      url,
      schema: Object.keys(schema).length > 0 ? schema : undefined,
      handler: handler as RouteHandlerMethod,
    });
  }
}
