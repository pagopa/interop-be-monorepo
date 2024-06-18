import {
  AuthToken,
  Logger,
  decodeJwtToken,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { TenantProcessClient } from "../providers/clientProvider.js";
import { z } from "zod";

// TODO implement this
type SessionTokenGenerator = {
  generate: (
    alg: string,
    claims: any,
    audience: string,
    issuer: string,
    duration: number
  ) => string;
};

const KMS_SIGNING_ALG = "RSASSA_PKCS1_V1_5_SHA_256";
// const SUB = "sub";
// const BEARER = "bearer";
const UID = "uid";
const ORGANIZATION = "organization";
const USER_ROLES = "user-roles";
// const CORRELATION_ID_HEADER = "X-Correlation-Id";
// const ACCEPT_LANGUAGE = "Accept-Language";
// const CONTENT_LANGUAGE = "Content-Language";
// const INTEROP_PRODUCT_NAME = "prod-interop";
// const PURPOSE_ID_CLAIM = "purposeId";
// const DIGEST_CLAIM = "digest";
const ORGANIZATION_ID_CLAIM = "organizationId";
const SELFCARE_ID_CLAIM = "selfcareId";
const ORGANIZATION_EXTERNAL_ID_CLAIM = "externalId";
const ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM = "origin";
const ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM = "value";
// const ORGANIZATION_EXTERNAL_ID_ORIGIN = "organizationExternalIdOrigin";
// const ORGANIZATION_EXTERNAL_ID_VALUE = "organizationExternalIdValue";
const NAME = "name";
const FAMILY_NAME = "family_name";
const EMAIL = "email";

// TODO get from app config
const config = {
  jwtAudience: "audience",
  jwtIssuer: "issuer",
  jwtDuration: 3600,
  tenantAllowedOrigins: ["origin"],
};

const SessionClaims = z.object({
  [UID]: z.string(),
  [ORGANIZATION]: z.string(),
  [NAME]: z.string(),
  [FAMILY_NAME]: z.string(),
  [EMAIL]: z.string(),
});
type SessionClaims = z.infer<typeof SessionClaims>;
// type SessionClaims = {
//   [UID]: string;
//   [ORGANIZATION]: string;
//   [NAME]: string;
//   [FAMILY_NAME]: string;
//   [EMAIL]: string;
// };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  // interopTokenGenerator: InteropTokenGenerator,
  sessionTokenGenerator: SessionTokenGenerator,
  tenantProcessClient: TenantProcessClient,
  allowList: string[]
) {
  const readJwt = async (
    identityToken: string,
    logger: Logger
  ): Promise<{
    roles: string;
    sessionClaims: SessionClaims;
    selfcareId: string;
  }> => {
    const verified = await verifyJwtToken(identityToken, logger);
    if (!verified) {
      throw new Error("Invalid token."); // TODO handle error
    }

    const decoded = decodeJwtToken(identityToken);
    const token = AuthToken.parse(decoded);

    if (token.role) {
      throw new Error("Token role not supported."); // TODO handle error
    }

    const sessionClaims = SessionClaims.parse(token);

    const selfcareId = token[ORGANIZATION].id; // TODO clarify why

    return {
      roles: token[USER_ROLES].join(","), // TODO check if this is enough
      sessionClaims,
      selfcareId,
    };
  };

  const assertTenantAllowed = (selfcareId: string, origin: string): void => {
    if (
      !config.tenantAllowedOrigins.includes(origin) &&
      !allowList.includes(selfcareId)
    ) {
      throw new Error("Tenant not allowed."); // TODO handle error
    }
  };

  const buildJwtCustomClaims = (
    roles: string,
    tenantId: string,
    selfcareId: string,
    tenantOrigin: string,
    tenantExternalId: string
  ) => ({
    [USER_ROLES]: roles,
    [ORGANIZATION_ID_CLAIM]: tenantId,
    [SELFCARE_ID_CLAIM]: selfcareId,
    [ORGANIZATION_EXTERNAL_ID_CLAIM]: {
      [ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM]: tenantOrigin,
      [ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM]: tenantExternalId,
    },
  });

  // const generateInternalTokenContexts = (
  //   _interopTokenGenerator: InteropTokenGenerator,
  //   _sessionClaims: any
  // ) => {
  //   throw new Error("Function not implemented.");
  // };

  return {
    getSessionToken: async (
      correlationId: string,
      identityToken: string,
      logger: Logger
    ) => {
      const { sessionClaims, roles, selfcareId } = await readJwt(
        identityToken,
        logger
      );

      // const internalContexts = generateInternalTokenContexts(
      //   interopTokenGenerator,
      //   sessionClaims
      // );

      // TODO capire perché due chiamate a getTenant
      // TODO capire internal context
      const tenantBySelfcareId =
        await tenantProcessClient.getTenantBySelfcareId({
          params: { selfcareId },
          headers: { "X-Correlation-Id": correlationId },
        });
      const tenantId = tenantBySelfcareId.id;

      const tenant = await tenantProcessClient.getTenant({
        params: { id: tenantId },
        headers: { "X-Correlation-Id": correlationId },
      });

      assertTenantAllowed(selfcareId, tenant.externalId.origin);

      // TODO rate limiter

      const customClaims = buildJwtCustomClaims(
        roles,
        tenantId,
        selfcareId,
        tenant.externalId.origin,
        tenant.externalId.value
      );

      return sessionTokenGenerator.generate(
        KMS_SIGNING_ALG,
        { ...sessionClaims, ...customClaims },
        config.jwtAudience,
        config.jwtIssuer,
        config.jwtDuration
      );
    },
  };
}
export type TenantService = ReturnType<typeof tenantServiceBuilder>;
