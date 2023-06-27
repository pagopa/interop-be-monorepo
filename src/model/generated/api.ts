import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const EServiceDescriptorState = z.enum([
  "DRAFT",
  "PUBLISHED",
  "DEPRECATED",
  "SUSPENDED",
  "ARCHIVED",
]);
const AgreementState = z.enum([
  "DRAFT",
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
  "MISSING_CERTIFIED_ATTRIBUTES",
  "REJECTED",
]);
const EServiceTechnology = z.enum(["REST", "SOAP"]);
const AttributeValue = z.object({
  id: z.string().uuid(),
  explicitAttributeVerification: z.boolean(),
});
const Attribute = z
  .object({ single: AttributeValue, group: z.array(AttributeValue) })
  .partial();
const Attributes = z.object({
  certified: z.array(Attribute),
  declared: z.array(Attribute),
  verified: z.array(Attribute),
});
const EServiceDoc = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
});
const AgreementApprovalPolicy = z.enum(["AUTOMATIC", "MANUAL"]);
const EServiceDescriptor = z.object({
  id: z.string().uuid(),
  version: z.string(),
  description: z.string().optional(),
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int().gte(0),
  dailyCallsTotal: z.number().int().gte(0),
  interface: EServiceDoc.optional(),
  docs: z.array(EServiceDoc),
  state: EServiceDescriptorState,
  agreementApprovalPolicy: AgreementApprovalPolicy,
  serverUrls: z.array(z.string()),
  publishedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
});
const EService = z.object({
  id: z.string().uuid(),
  producerId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  technology: EServiceTechnology,
  attributes: Attributes,
  descriptors: z.array(EServiceDescriptor),
});
const EServices = z.object({
  results: z.array(EService),
  totalCount: z.number().int(),
});
const AttributeValueSeed = z.object({
  id: z.string().uuid(),
  explicitAttributeVerification: z.boolean(),
});
const AttributeSeed = z
  .object({ single: AttributeValueSeed, group: z.array(AttributeValueSeed) })
  .partial();
const AttributesSeed = z.object({
  certified: z.array(AttributeSeed),
  declared: z.array(AttributeSeed),
  verified: z.array(AttributeSeed),
});
const EServiceSeed = z.object({
  name: z.string().min(5).max(60),
  description: z.string().min(10).max(250),
  technology: EServiceTechnology,
  attributes: AttributesSeed,
});
const ProblemError = z.object({
  code: z
    .string()
    .min(8)
    .max(8)
    .regex(/^[0-9]{3}-[0-9]{4}$/),
  detail: z
    .string()
    .max(4096)
    .regex(/^.{0,1024}$/),
});
const Problem = z.object({
  type: z.string(),
  status: z.number().int().gte(100).lt(600),
  title: z
    .string()
    .max(64)
    .regex(/^[ -~]{0,64}$/),
  correlationId: z.string().max(64).optional(),
  detail: z
    .string()
    .max(4096)
    .regex(/^.{0,1024}$/)
    .optional(),
  errors: z.array(ProblemError).min(1),
});
const UpdateEServiceSeed = z.object({
  name: z.string().min(5).max(60),
  description: z.string().min(10).max(250),
  technology: EServiceTechnology,
  attributes: AttributesSeed,
});

export const schemas = {
  EServiceDescriptorState,
  AgreementState,
  EServiceTechnology,
  AttributeValue,
  Attribute,
  Attributes,
  EServiceDoc,
  AgreementApprovalPolicy,
  EServiceDescriptor,
  EService,
  EServices,
  AttributeValueSeed,
  AttributeSeed,
  AttributesSeed,
  EServiceSeed,
  ProblemError,
  Problem,
  UpdateEServiceSeed,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/eservices",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "X-Forwarded-For",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "eservicesIds",
        type: "Query",
        schema: z.array(z.string()).optional().default([]),
      },
      {
        name: "producersIds",
        type: "Query",
        schema: z.array(z.string()).optional().default([]),
      },
      {
        name: "states",
        type: "Query",
        schema: z.array(EServiceDescriptorState).optional().default([]),
      },
      {
        name: "agreementStates",
        type: "Query",
        schema: z.array(AgreementState).optional().default([]),
      },
      {
        name: "offset",
        type: "Query",
        schema: z.number().int().gte(0),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().int().gte(1).lte(50),
      },
    ],
    response: EServices,
  },
  {
    method: "post",
    path: "/eservices",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `An E-Service seed`,
        type: "Body",
        schema: EServiceSeed,
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "X-Forwarded-For",
        type: "Header",
        schema: z.string().optional(),
      },
    ],
    response: EService,
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
      {
        status: 409,
        description: `Name Conflict`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
    ],
  },
  {
    method: "get",
    path: "/eservices/:eServiceId",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "X-Forwarded-For",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "eServiceId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: EService,
    errors: [
      {
        status: 400,
        description: `Bad request`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
      {
        status: 404,
        description: `E-Service not found`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
    ],
  },
  {
    method: "put",
    path: "/eservices/:eServiceId",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `An E-Service update seed containing the possible updatable fields`,
        type: "Body",
        schema: UpdateEServiceSeed,
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "X-Forwarded-For",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "eServiceId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: EService,
    errors: [
      {
        status: 400,
        description: `Bad request`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
      {
        status: 404,
        description: `E-Service not found`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
    ],
  },
  {
    method: "delete",
    path: "/eservices/:eServiceId",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "X-Forwarded-For",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "eServiceId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
      {
        status: 404,
        description: `Not found`,
        schema: z.object({
          type: z.string(),
          status: z.number().int().gte(100).lt(600),
          title: z
            .string()
            .max(64)
            .regex(/^[ -~]{0,64}$/),
          correlationId: z.string().max(64).optional(),
          detail: z
            .string()
            .max(4096)
            .regex(/^.{0,1024}$/)
            .optional(),
          errors: z.array(ProblemError).min(1),
        }),
      },
    ],
  },
  {
    method: "get",
    path: "/status",
    description: `Return ok`,
    requestFormat: "json",
    response: z.object({
      type: z.string(),
      status: z.number().int().gte(100).lt(600),
      title: z
        .string()
        .max(64)
        .regex(/^[ -~]{0,64}$/),
      correlationId: z.string().max(64).optional(),
      detail: z
        .string()
        .max(4096)
        .regex(/^.{0,1024}$/)
        .optional(),
      errors: z.array(ProblemError).min(1),
    }),
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
