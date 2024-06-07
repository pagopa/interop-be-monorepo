import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const ExternalId = z
  .object({ origin: z.string().min(3).max(64), value: z.string() })
  .passthrough();
const InternalAttributeSeed = z
  .object({
    origin: z.string().min(3).max(64),
    code: z.string().min(1).max(64),
  })
  .passthrough();
const InternalTenantSeed = z
  .object({
    externalId: ExternalId,
    certifiedAttributes: z.array(InternalAttributeSeed),
    name: z.string().min(1).max(1000),
  })
  .passthrough();
const Certifier = z.object({ certifierId: z.string() }).passthrough();
const TenantFeature = z
  .object({ certifier: Certifier })
  .partial()
  .passthrough();
const DeclaredTenantAttribute = z
  .object({
    id: z.string().uuid(),
    assignmentTimestamp: z.string().datetime({ offset: true }),
    revocationTimestamp: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const CertifiedTenantAttribute = z
  .object({
    id: z.string().uuid(),
    assignmentTimestamp: z.string().datetime({ offset: true }),
    revocationTimestamp: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const TenantVerifier = z
  .object({
    id: z.string().uuid(),
    verificationDate: z.string().datetime({ offset: true }),
    expirationDate: z.string().datetime({ offset: true }).optional(),
    extensionDate: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const TenantRevoker = z
  .object({
    id: z.string().uuid(),
    verificationDate: z.string().datetime({ offset: true }),
    expirationDate: z.string().datetime({ offset: true }).optional(),
    extensionDate: z.string().datetime({ offset: true }).optional(),
    revocationDate: z.string().datetime({ offset: true }),
  })
  .passthrough();
const VerifiedTenantAttribute = z
  .object({
    id: z.string().uuid(),
    assignmentTimestamp: z.string().datetime({ offset: true }),
    verifiedBy: z.array(TenantVerifier),
    revokedBy: z.array(TenantRevoker),
  })
  .passthrough();
const TenantAttribute = z
  .object({
    declared: DeclaredTenantAttribute,
    certified: CertifiedTenantAttribute,
    verified: VerifiedTenantAttribute,
  })
  .partial()
  .passthrough();
const MailKind = z.enum(["CONTACT_EMAIL", "DIGITAL_ADDRESS"]);
const Mail = z
  .object({
    kind: MailKind,
    address: z.string().max(30),
    createdAt: z.string().datetime({ offset: true }),
    description: z.string().max(250).optional(),
  })
  .passthrough();
const TenantKind = z.enum(["PA", "PRIVATE", "GSP"]);
const Tenant = z
  .object({
    id: z.string().uuid(),
    selfcareId: z.string().optional(),
    externalId: ExternalId,
    features: z.array(TenantFeature),
    attributes: z.array(TenantAttribute),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }).optional(),
    mails: z.array(Mail),
    name: z.string(),
    kind: TenantKind.optional(),
  })
  .passthrough();
const ProblemError = z
  .object({
    code: z
      .string()
      .min(8)
      .max(8)
      .regex(/^[0-9]{3}-[0-9]{4}$/),
    detail: z
      .string()
      .max(4096)
      .regex(/^.{0,1024}$/),
  })
  .passthrough();
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
const M2MAttributeSeed = z
  .object({ code: z.string().min(1).max(64) })
  .passthrough();
const M2MTenantSeed = z
  .object({
    externalId: ExternalId,
    certifiedAttributes: z.array(M2MAttributeSeed),
    name: z.string().min(1).max(1000),
  })
  .passthrough();
const SelfcareTenantSeed = z
  .object({
    externalId: ExternalId,
    selfcareId: z.string(),
    name: z.string().min(1).max(1000),
  })
  .passthrough();
const ResourceId = z.object({ id: z.string().uuid() }).passthrough();
const Tenants = z
  .object({ results: z.array(Tenant), totalCount: z.number().int() })
  .passthrough();
const CertifiedAttribute = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    attributeId: z.string().uuid(),
    attributeName: z.string(),
  })
  .passthrough();
const CertifiedAttributes = z
  .object({
    results: z.array(CertifiedAttribute),
    totalCount: z.number().int(),
  })
  .passthrough();
const DeclaredTenantAttributeSeed = z
  .object({ id: z.string().uuid() })
  .passthrough();
const VerifiedTenantAttributeSeed = z
  .object({
    id: z.string().uuid(),
    expirationDate: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const UpdateVerifiedTenantAttributeSeed = z
  .object({ expirationDate: z.string().datetime({ offset: true }) })
  .partial()
  .passthrough();

export const schemas = {
  ExternalId,
  InternalAttributeSeed,
  InternalTenantSeed,
  Certifier,
  TenantFeature,
  DeclaredTenantAttribute,
  CertifiedTenantAttribute,
  TenantVerifier,
  TenantRevoker,
  VerifiedTenantAttribute,
  TenantAttribute,
  MailKind,
  Mail,
  TenantKind,
  Tenant,
  ProblemError,
  Problem,
  M2MAttributeSeed,
  M2MTenantSeed,
  SelfcareTenantSeed,
  ResourceId,
  Tenants,
  CertifiedAttribute,
  CertifiedAttributes,
  DeclaredTenantAttributeSeed,
  VerifiedTenantAttributeSeed,
  UpdateVerifiedTenantAttributeSeed,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/consumers",
    alias: "getConsumers",
    description: `Retrieve Tenants that are subscribed to at least one EService`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
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
    response: Tenants,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
    method: "post",
    path: "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
    alias: "internalAssignCertifiedAttribute",
    description: `Assigns a Certified attribute to the requesting Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tOrigin",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "tExternalId",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "aOrigin",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "aExternalId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
        description: `Attribute already assigned to Tenant`,
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
    path: "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
    alias: "internalRevokeCertifiedAttribute",
    description: `Revokes a Certified attribute to the requesting Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tOrigin",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "tExternalId",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "aOrigin",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "aExternalId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
        description: `Tenant Attribute Not Found`,
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
    method: "post",
    path: "/internal/tenants",
    alias: "internalUpsertTenant",
    description: `Creates the Tenant if it does not exist. Otherwise, add missing attributes.
Used when the attribute origin is known
`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: InternalTenantSeed,
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: Tenant,
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
    ],
  },
  {
    method: "delete",
    path: "/m2m/origin/:origin/externalId/:externalId/attributes/:code",
    alias: "m2mRevokeAttribute",
    description: `Revokes the specific attribute from the tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "origin",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "externalId",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "code",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `BadRequest`,
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
        status: 403,
        description: `Forbidden`,
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
        description: `Not Found`,
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
    method: "post",
    path: "/m2m/tenants",
    alias: "m2mUpsertTenant",
    description: `Creates the Tenant if it does not exist. Otherwise, add missing attributes.
Used when the attribute origin should be deducted from requester
`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: M2MTenantSeed,
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: Tenant,
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
        status: 403,
        description: `Forbidden`,
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
    path: "/producers",
    alias: "getProducers",
    description: `Retrieve Tenants that have published an EService`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
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
    response: Tenants,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
    method: "post",
    path: "/selfcare/tenants",
    alias: "selfcareUpsertTenant",
    description: `Creates the Tenant if it does not exist. Otherwise, set Tenant SelfcareId.
Used when the request source is SelfCare
`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: SelfcareTenantSeed,
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: z.object({ id: z.string().uuid() }).passthrough(),
    errors: [
      {
        status: 409,
        description: `Selfcare Id is already assigned and is different from the request`,
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
    alias: "getStatus",
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
  {
    method: "get",
    path: "/tenants",
    alias: "getTenants",
    description: `Retrieve Tenants by name`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "name",
        type: "Query",
        schema: z.string().optional(),
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
    response: Tenants,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
    path: "/tenants/:id",
    alias: "getTenant",
    description: `Retrieve the Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "id",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 404,
        description: `Tenant Not Found`,
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
    method: "post",
    path: "/tenants/:tenantId/attributes/verified",
    alias: "verifyVerifiedAttribute",
    description: `Verify or de-revoke a Verified attribute to a Tenant by the requester Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: VerifiedTenantAttributeSeed,
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tenantId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 403,
        description: `Forbidden`,
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
        description: `Tenant Not Found`,
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
    path: "/tenants/:tenantId/attributes/verified/:attributeId",
    alias: "revokeVerifiedAttribute",
    description: `Revoke a Verified attribute to a Tenant by the requester Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tenantId",
        type: "Path",
        schema: z.string().uuid(),
      },
      {
        name: "attributeId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 403,
        description: `Forbidden`,
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
        description: `Tenant Not Found`,
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
        description: `Attribute already revoked for the Tenant`,
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
    method: "post",
    path: "/tenants/:tenantId/attributes/verified/:attributeId",
    alias: "updateVerifiedAttribute",
    description: `Update expirationDate for Verified Attribute of Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z
          .object({ expirationDate: z.string().datetime({ offset: true }) })
          .partial()
          .passthrough(),
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tenantId",
        type: "Path",
        schema: z.string().uuid(),
      },
      {
        name: "attributeId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
        status: 403,
        description: `Forbidden`,
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
        description: `Tenant Not Found`,
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
    method: "post",
    path: "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
    alias: "updateVerifiedAttributeExtensionDate",
    description: `Update attribute extensionDate to a Tenant by the requester Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tenantId",
        type: "Path",
        schema: z.string().uuid(),
      },
      {
        name: "attributeId",
        type: "Path",
        schema: z.string().uuid(),
      },
      {
        name: "verifierId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
        status: 403,
        description: `Forbidden`,
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
        description: `Not Found`,
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
    path: "/tenants/attributes/certified",
    alias: "getCertifiedAttributes",
    description: `Retrieve the certified attributes`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
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
    response: CertifiedAttributes,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
        status: 403,
        description: `Forbidden`,
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
    method: "post",
    path: "/tenants/attributes/declared",
    alias: "addDeclaredAttribute",
    description: `Adds a Declared attribute to the requesting Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ id: z.string().uuid() }).passthrough(),
      },
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 409,
        description: `Attribute already assigned to Tenant`,
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
    path: "/tenants/attributes/declared/:attributeId",
    alias: "revokeDeclaredAttribute",
    description: `Revokes a Declared attribute to the requesting Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "attributeId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
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
        description: `Tenant Attribute Not Found`,
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
    path: "/tenants/origin/:origin/code/:code",
    alias: "getTenantByExternalId",
    description: `Retrieve the Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "origin",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "code",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 404,
        description: `Tenant Not Found`,
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
    path: "/tenants/selfcare/:selfcareId",
    alias: "getTenantBySelfcareId",
    description: `Retrieve the Tenant`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "selfcareId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: Tenant,
    errors: [
      {
        status: 404,
        description: `Tenant Not Found`,
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
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
