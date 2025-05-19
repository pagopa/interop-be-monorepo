import {
  attributeRegistryApi,
  delegationApi,
  purposeApi,
  tenantApi,
  authorizationApi,
  m2mGatewayApi,
  eserviceTemplateApi,
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

export function getMockedApiPurposeVersion({
  state,
}: {
  state?: purposeApi.PurposeVersionState;
} = {}): purposeApi.PurposeVersion {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    dailyCalls: generateMock(z.number().positive()),
    state: state ?? purposeApi.PurposeVersionState.Enum.DRAFT,
  };
}

export function getMockedApiPurpose({
  versions,
}: {
  versions?: purposeApi.PurposeVersion[];
} = {}): WithMetadata<purposeApi.Purpose> {
  return {
    data: {
      id: generateId(),
      eserviceId: generateId(),
      consumerId: generateId(),
      versions: versions ?? [getMockedApiPurposeVersion()],
      title: generateMock(z.string().length(10)),
      description: generateMock(z.string().length(10)),
      createdAt: new Date().toISOString(),
      isRiskAnalysisValid: true,
      isFreeOfCharge: true,
      freeOfChargeReason: generateMock(z.string()),
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiDelegation({
  kind,
  eserviceId,
  delegateId,
  state,
}: {
  kind?: delegationApi.DelegationKind;
  eserviceId?: string;
  delegateId?: string;
  state?: delegationApi.DelegationState;
} = {}): WithMetadata<delegationApi.Delegation> {
  return {
    data: {
      kind: kind ?? delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      id: generateId(),
      eserviceId: eserviceId ?? generateId(),
      delegateId: delegateId ?? generateId(),
      delegatorId: generateId(),
      createdAt: new Date().toISOString(),
      state: state ?? delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
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
      mails: generateMock(z.array(tenantApi.Mail)),
      features: generateMock(z.array(tenantApi.TenantFeature)),
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiAttribute({
  kind,
  code,
  name,
  description,
}: {
  kind?: attributeRegistryApi.AttributeKind;
  code?: string;
  name?: string;
  description?: string;
} = {}): WithMetadata<attributeRegistryApi.Attribute> {
  return {
    data: {
      id: generateId(),
      name: name ?? generateMock(z.string()),
      description: description ?? generateMock(z.string()),
      creationTime: new Date().toISOString(),
      code: code ?? generateMock(z.string()),
      origin: generateMock(z.string()),
      kind: kind ?? attributeRegistryApi.AttributeKind.Values.CERTIFIED,
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
      name: generateMock(z.string()),
      description: generateMock(z.string()),
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

export const m2mTestToken = generateMock(z.string().base64());
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
    serviceName: serviceName || generateMock(z.string()),
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

export function getMockedApiEServiceTemplate(): WithMetadata<eserviceTemplateApi.EServiceTemplate> {
  return {
    data: {
      id: generateId(),
      creatorId: generateId(),
      description: generateMock(z.string().length(10)),
      intendedTarget: generateMock(z.string().length(10)),
      mode: generateMock(m2mGatewayApi.EServiceMode),
      name: generateMock(z.string().length(10)),
      technology: generateMock(m2mGatewayApi.EServiceTechnology),
      versions: [getMockedApiEserviceTemplateVersion()],
      isSignalHubEnabled: generateMock(z.boolean().optional()),
      riskAnalysis: [],
    },
    metadata: {
      version: 0,
    },
  };
}

export function getMockedApiEserviceTemplateVersion(): eserviceTemplateApi.EServiceTemplateVersion {
  return {
    id: generateId(),
    state: generateMock(m2mGatewayApi.EServiceTemplateVersionState),
    voucherLifespan: generateMock(z.number().positive()),
    version: 0,
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
    docs: [],
  };
}
