import {
  attributeRegistryApi,
  delegationApi,
  tenantApi,
  authorizationApi,
} from "pagopa-interop-api-clients";
import { WithLogger, systemRole, genericLogger } from "pagopa-interop-commons";
import {
  CorrelationId,
  TenantId,
  WithMetadata,
  generateId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { M2MGatewayAppContext } from "../src/utils/context.js";

export function getMockedApiDelegation({
  kind,
  eserviceId,
  delegateId,
}: {
  kind?: delegationApi.DelegationKind;
  eserviceId?: string;
  delegateId?: string;
} = {}): WithMetadata<delegationApi.Delegation> {
  return {
    data: {
      kind: kind ?? delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      id: generateId(),
      eserviceId: eserviceId ?? generateId(),
      delegateId: delegateId ?? generateId(),
      delegatorId: generateId(),
      createdAt: new Date().toISOString(),
      state: delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
      stamps: {
        submission: {
          who: generateId(),
          when: new Date().toISOString(),
        },
      },
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiTenant({
  attributes,
}: {
  attributes?: tenantApi.TenantAttribute[];
} = {}): WithMetadata<tenantApi.Tenant> {
  return {
    data: {
      id: generateId(),
      attributes:
        attributes ?? generateMock(z.array(tenantApi.TenantAttribute)),
      externalId: {
        origin: generateMock(z.string()),
        value: generateMock(z.string()),
      },
      name: generateMock(z.string()),
      createdAt: new Date().toISOString(),
      kind: tenantApi.TenantKind.Values.GSP,
      mails: [],
      features: [],
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiAttribute({
  kind,
}: {
  kind?: attributeRegistryApi.AttributeKind;
} = {}): WithMetadata<attributeRegistryApi.Attribute> {
  return {
    data: {
      id: generateId(),
      creationTime: new Date().toISOString(),
      description: generateMock(z.string()),
      name: generateMock(z.string()),
      kind: kind ?? attributeRegistryApi.AttributeKind.Values.CERTIFIED,
      code: generateMock(z.string()),
      origin: generateMock(z.string()),
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiClient({
  kind: paramKind,
}: {
  kind?: authorizationApi.ClientKind;
} = {}): WithMetadata<authorizationApi.Client> {
  const kind = paramKind ?? authorizationApi.ClientKind.Values.API;
  return {
    data: {
      kind,
      id: generateId(),
      name: "test-client",
      description: "test-client",
      createdAt: new Date().toISOString(),
      consumerId: generateId(),
      purposes: [],
      users: [],
      adminId:
        kind === authorizationApi.ClientKind.Values.API
          ? generateId()
          : undefined,
    },
    metadata: {
      version: 0,
    },
  };
}

export const m2mTestToken = "test-token";
export const getMockM2MAdminAppContext = ({
  organizationId,
  serviceName,
}: {
  organizationId?: TenantId;
  serviceName?: string;
} = {}): WithLogger<M2MGatewayAppContext> => {
  const correlationId = generateId<CorrelationId>();
  return {
    authData: {
      systemRole: systemRole.M2M_ADMIN_ROLE,
      organizationId: organizationId || generateId(),
      userId: generateId(),
      clientId: generateId(),
    },
    serviceName: serviceName || "test",
    spanId: generateId(),
    logger: genericLogger,
    requestTimestamp: Date.now(),
    correlationId,
    headers: {
      "X-Correlation-Id": correlationId,
      Authorization: `Bearer ${m2mTestToken}`,
      "X-Forwarded-For": undefined,
    },
  };
};
