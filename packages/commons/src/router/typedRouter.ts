import { Router, Request, Response, NextFunction } from "express";
import { z, ZodType } from "zod";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head";

export type EndpointParameter = {
  name: string;
  type: "Query" | "Body" | "Header" | "Path";
  schema: ZodType;
  description?: string;
};

export type EndpointDefinition = {
  method: HttpMethod;
  path: string;
  alias?: string;
  description?: string;
  requestFormat?: string;
  parameters?: EndpointParameter[];
  response?: ZodType;
  errors?: Array<{ status: number | "default"; schema: ZodType }>;
};

type ValidationErrorHandler = (
  zodError: { context: string; error: z.ZodIssue[] },
  req: Request,
  res: Response,
  next: NextFunction
) => unknown;

type TypedRouterOptions = {
  validationErrorHandler?: ValidationErrorHandler;
};

// Type-level extraction of parameter schemas
export type ExtractParam<
  P extends ReadonlyArray<EndpointParameter>,
  T extends string
> = P extends ReadonlyArray<infer E>
  ? E extends { type: T; name: infer N; schema: infer S }
    ? N extends string
      ? S extends ZodType
        ? { [K in N]: z.output<S> }
        : never
      : never
    : never
  : never;

export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type ExtractQueryParams<P extends ReadonlyArray<EndpointParameter>> =
  UnionToIntersection<ExtractParam<P, "Query">>;

export type ExtractPathParams<P extends ReadonlyArray<EndpointParameter>> =
  UnionToIntersection<ExtractParam<P, "Path">>;

export type ExtractBody<P extends ReadonlyArray<EndpointParameter>> =
  P extends ReadonlyArray<infer E>
    ? E extends { type: "Body"; schema: infer S }
      ? S extends ZodType
        ? z.output<S>
        : never
      : never
    : never;

type FindEndpoint<
  Endpoints extends ReadonlyArray<EndpointDefinition>,
  M extends HttpMethod,
  P extends string
> = Endpoints extends ReadonlyArray<infer E>
  ? E extends EndpointDefinition
    ? E extends { method: M; path: P }
      ? E
      : never
    : never
  : never;

type TypedRequest<E extends EndpointDefinition> = Request<
  E["parameters"] extends ReadonlyArray<EndpointParameter>
    ? ExtractPathParams<E["parameters"]>
    : Record<string, string>,
  unknown,
  E["parameters"] extends ReadonlyArray<EndpointParameter>
    ? ExtractBody<E["parameters"]>
    : unknown,
  E["parameters"] extends ReadonlyArray<EndpointParameter>
    ? ExtractQueryParams<E["parameters"]>
    : unknown
>;

type TypedHandler<E extends EndpointDefinition> = (
  req: TypedRequest<E> & { ctx: import("../context/context.js").AppContext },
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

type TypedRouterMethods<Endpoints extends ReadonlyArray<EndpointDefinition>> = {
  [M in HttpMethod]: <
    P extends Extract<Endpoints[number], { method: M }>["path"]
  >(
    path: P,
    ...handlers: Array<TypedHandler<FindEndpoint<Endpoints, M, P>>>
  ) => TypedRouterMethods<Endpoints>;
};

type TypedRouter<Endpoints extends ReadonlyArray<EndpointDefinition>> =
  TypedRouterMethods<Endpoints> & {
    expressRouter: Router;
  };

// eslint-disable-next-line sonarjs/cognitive-complexity
function buildValidationMiddleware(
  endpoint: EndpointDefinition,
  options: TypedRouterOptions
): ((req: Request, res: Response, next: NextFunction) => void) | undefined {
  const params = endpoint.parameters;
  if (!params || params.length === 0) {
    return undefined;
  }

  const queryParams = params.filter((p) => p.type === "Query");
  const pathParams = params.filter((p) => p.type === "Path");
  const bodyParam = params.find((p) => p.type === "Body");

  const querySchema =
    queryParams.length > 0
      ? z.object(Object.fromEntries(queryParams.map((p) => [p.name, p.schema])))
      : undefined;

  const pathSchema =
    pathParams.length > 0
      ? z.object(Object.fromEntries(pathParams.map((p) => [p.name, p.schema])))
      : undefined;

  const bodySchema = bodyParam?.schema;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        if (options.validationErrorHandler) {
          options.validationErrorHandler(
            { context: "query", error: result.error.issues },
            req,
            res,
            next
          );
          return;
        }
        res.status(400).json({ error: "Invalid query parameters" });
        return;
      }
      // eslint-disable-next-line functional/immutable-data
      req.query = result.data;
    }

    if (pathSchema) {
      const result = pathSchema.safeParse(req.params);
      if (!result.success) {
        if (options.validationErrorHandler) {
          options.validationErrorHandler(
            { context: "params", error: result.error.issues },
            req,
            res,
            next
          );
          return;
        }
        res.status(400).json({ error: "Invalid path parameters" });
        return;
      }
      // eslint-disable-next-line functional/immutable-data
      req.params = result.data;
    }

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        if (options.validationErrorHandler) {
          options.validationErrorHandler(
            { context: "body", error: result.error.issues },
            req,
            res,
            next
          );
          return;
        }
        res.status(400).json({ error: "Invalid request body" });
        return;
      }
      // eslint-disable-next-line functional/immutable-data
      req.body = result.data;
    }

    next();
  };
}

// Convert Zodios-style `:param` paths — they already match Express format
function toExpressPath(path: string): string {
  return path;
}

export function createTypedRouter<
  const Endpoints extends ReadonlyArray<EndpointDefinition>
>(
  endpoints: Endpoints,
  options: TypedRouterOptions = {}
): TypedRouter<Endpoints> {
  const router = Router({ mergeParams: true });

  // Express needs JSON body parsing — but it's typically set up at app level
  // We don't add it here to avoid double-parsing

  const methods = {} as TypedRouterMethods<Endpoints>;

  const httpMethods: HttpMethod[] = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
  ];

  for (const method of httpMethods) {
    // eslint-disable-next-line functional/immutable-data
    (methods as Record<string, unknown>)[method] = (
      path: string,
      ...handlers: Array<
        (req: Request, res: Response, next: NextFunction) => unknown
      >
    ): TypedRouterMethods<Endpoints> => {
      const endpoint = (endpoints as ReadonlyArray<EndpointDefinition>).find(
        (e) => e.method === method && e.path === path
      );

      const expressPath = toExpressPath(path);
      const validationMiddleware = endpoint
        ? buildValidationMiddleware(endpoint, options)
        : undefined;

      if (validationMiddleware) {
        router[method](expressPath, validationMiddleware, ...handlers);
      } else {
        router[method](expressPath, ...handlers);
      }

      return methods;
    };
  }

  return {
    ...methods,
    expressRouter: router,
  } as TypedRouter<Endpoints>;
}
