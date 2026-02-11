import { Router, Request, Response, NextFunction } from "express";
import { z, ZodType } from "zod";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head";

type DeepMutable<T> = T extends ZodType
  ? T
  : T extends object
  ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
  : T;

export function defineEndpoints<const T extends ReadonlyArray<RouteDefinition>>(
  endpoints: T
): DeepMutable<T> {
  return endpoints as DeepMutable<T>;
}

export type RouteDefinition = {
  method: HttpMethod;
  path: string;
  operationId: string;
  description?: string;
  summary?: string;
  tags?: string[];
  security?: Array<Record<string, string[]>>;
  request?: {
    params?: z.AnyZodObject;
    body?: {
      content: {
        "application/json": {
          schema: z.ZodType;
        };
      };
      required?: boolean;
      description?: string;
    };
    headers?: z.AnyZodObject;
    query?: z.AnyZodObject;
  };
  responses: Record<
    number | string,
    {
      description: string;
      content?: Record<string, { schema: z.ZodType }>;
    }
  >;
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

// Type-level extraction from RouteDefinition
type ExtractParams<R> = R extends {
  request: { params: infer P extends z.AnyZodObject };
}
  ? z.output<P>
  : Record<string, string>;

type ExtractBody<R> = R extends {
  request: {
    body: {
      content: { "application/json": { schema: infer S extends ZodType } };
    };
  };
}
  ? z.output<S>
  : unknown;

type ExtractQuery<R> = R extends {
  request: { query: infer Q extends z.AnyZodObject };
}
  ? z.output<Q>
  : unknown;

type FindRoute<
  Routes extends ReadonlyArray<RouteDefinition>,
  M extends HttpMethod,
  P extends string
> = Routes extends ReadonlyArray<infer R>
  ? R extends RouteDefinition
    ? R extends { method: M; path: P }
      ? R
      : never
    : never
  : never;

type TypedRequest<R extends RouteDefinition> = Request<
  ExtractParams<R>,
  unknown,
  ExtractBody<R>,
  ExtractQuery<R>
>;

type TypedHandler<R extends RouteDefinition> = (
  req: TypedRequest<R> & { ctx: import("../context/context.js").AppContext },
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

type TypedRouterMethods<Routes extends ReadonlyArray<RouteDefinition>> = {
  [M in HttpMethod]: <P extends Extract<Routes[number], { method: M }>["path"]>(
    path: P,
    ...handlers: Array<TypedHandler<FindRoute<Routes, M, P>>>
  ) => TypedRouterMethods<Routes>;
};

type TypedRouter<Routes extends ReadonlyArray<RouteDefinition>> =
  TypedRouterMethods<Routes> & {
    expressRouter: Router;
  };

function toExpressPath(path: string): string {
  return path.replace(/\{(\w+)\}/g, ":$1");
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function buildValidationMiddleware(
  route: RouteDefinition,
  options: TypedRouterOptions
): ((req: Request, res: Response, next: NextFunction) => void) | undefined {
  const request = route.request;
  if (!request) {
    return undefined;
  }

  const paramsSchema = request.params;
  const querySchema = request.query;
  const bodySchema = request.body?.content?.["application/json"]?.schema;

  if (!paramsSchema && !querySchema && !bodySchema) {
    return undefined;
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const validateField = (
      schema: ZodType | undefined,
      data: unknown,
      context: string
    ): { valid: false } | { valid: true; data: unknown } => {
      if (!schema) {
        return { valid: true, data };
      }
      const result = schema.safeParse(data);
      if (!result.success) {
        if (options.validationErrorHandler) {
          options.validationErrorHandler(
            { context, error: result.error.issues },
            req,
            res,
            next
          );
        } else {
          res.status(400).json({ error: `Invalid ${context}` });
        }
        return { valid: false };
      }
      return { valid: true, data: result.data };
    };

    const query = validateField(querySchema, req.query, "query");
    if (!query.valid) {
      return;
    }
    // eslint-disable-next-line functional/immutable-data
    req.query = query.data as Request["query"];

    const params = validateField(paramsSchema, req.params, "params");
    if (!params.valid) {
      return;
    }
    // eslint-disable-next-line functional/immutable-data
    req.params = params.data as Request["params"];

    const body = validateField(bodySchema, req.body, "body");
    if (!body.valid) {
      return;
    }
    // eslint-disable-next-line functional/immutable-data
    req.body = body.data;

    next();
  };
}

export function createTypedRouter<
  const Routes extends ReadonlyArray<RouteDefinition>
>(routes: Routes, options: TypedRouterOptions = {}): TypedRouter<Routes> {
  const router = Router({ mergeParams: true });

  const methods = {} as TypedRouterMethods<Routes>;

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
    ): TypedRouterMethods<Routes> => {
      const route = (routes as ReadonlyArray<RouteDefinition>).find(
        (r) => r.method === method && r.path === path
      );

      const expressPath = toExpressPath(path);
      const validationMiddleware = route
        ? buildValidationMiddleware(route, options)
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
  } as TypedRouter<Routes>;
}
