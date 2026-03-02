import { ZodiosRequestHandler } from "@zodios/express";
import { z } from "zod";
import {
  ZodiosPathsByMethod,
  ZodiosEndpointDefinition,
  Method,
} from "@zodios/core";

export type Middleware<
  Api extends ZodiosEndpointDefinition[],
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Context extends z.ZodObject<any>,
> = ZodiosRequestHandler<Api, Context, M, Path>;
