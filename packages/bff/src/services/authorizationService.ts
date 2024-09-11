import { XMLParser } from "fast-xml-parser";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  AuthToken,
  CustomClaims,
  InteropTokenGenerator,
  Logger,
  ORGANIZATION,
  ORGANIZATION_EXTERNAL_ID_CLAIM,
  ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM,
  ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM,
  ORGANIZATION_ID_CLAIM,
  RateLimiter,
  RateLimiterStatus,
  SELFCARE_ID_CLAIM,
  SessionClaims,
  UID,
  USER_ROLES,
  decodeJwtToken,
  userRoles,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { TenantId, genericError, unsafeBrandId } from "pagopa-interop-models";
import { config } from "../config/config.js";
import {
  missingClaim,
  missingSelfcareId,
  samlNotValid,
  tenantLoginNotAllowed,
  tokenVerificationFailed,
} from "../model/domain/errors.js";
import { SAMLResponse } from "../model/types.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";

const SUPPORT_LEVELS = ["L2", "L3"];
const SUPPORT_LEVEL_NAME = "supportLevel";
const SUPPORT_USER_ID = "5119b1fa-825a-4297-8c9c-152e055cabca";

type GetSessionTokenReturnType =
  | {
      limitReached: true;
      sessionToken: undefined;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    }
  | {
      limitReached: false;
      sessionToken: string;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  interopTokenGenerator: InteropTokenGenerator,
  tenantProcessClient: PagoPAInteropBeClients["tenantProcessClient"],
  allowList: string[],
  rateLimiter: RateLimiter
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
      throw tokenVerificationFailed();
    }

    const decoded = decodeJwtToken(identityToken);

    const {
      success: validToken,
      data: token,
      error,
    } = AuthToken.safeParse(decoded);
    if (!validToken) {
      const claim = error?.errors[0]?.path.join(".");
      throw missingClaim(claim);
    }

    if (token.role) {
      throw genericError("User roles in context are not in valid format");
    }

    const sessionClaims = SessionClaims.parse(token);

    const selfcareId = token[ORGANIZATION].id;

    return {
      roles: token[USER_ROLES].join(","),
      sessionClaims,
      selfcareId,
    };
  };

  const assertTenantAllowed = (selfcareId: string, origin: string): void => {
    if (
      !config.tenantAllowedOrigins.includes(origin) &&
      !allowList.includes(selfcareId)
    ) {
      throw tenantLoginNotAllowed(selfcareId);
    }
  };

  const buildJwtCustomClaims = (
    roles: string,
    tenantId: string,
    selfcareId: string,
    tenantOrigin: string,
    tenantExternalId: string
  ): CustomClaims => ({
    [USER_ROLES]: roles,
    [ORGANIZATION_ID_CLAIM]: tenantId,
    [SELFCARE_ID_CLAIM]: selfcareId,
    [ORGANIZATION_EXTERNAL_ID_CLAIM]: {
      [ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM]: tenantOrigin,
      [ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM]: tenantExternalId,
    },
  });

  const validateSignature = (saml: SAMLResponse): void => {
    const response = saml.Response;
    const reference = response?.Signature?.SignedInfo?.Reference;
    if (!reference) {
      throw samlNotValid("Missing Signature Reference");
    }
    if (reference.URI !== response?.ID) {
      throw samlNotValid("Reference URI is not compliant");
    }
    const transforms = reference.Transforms?.Transform;
    if (!transforms) {
      throw samlNotValid("Missing Transforms");
    }
    if (transforms.length > 2) {
      throw samlNotValid("Transforms are not compliant");
    }
    const atLeastOneEnvelopedSignature = !transforms.some(
      (t) =>
        t.Algorithm === "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
    );
    const allAlgorithmsAreValid = transforms.every(
      (t) =>
        t.Algorithm &&
        [
          "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
          "http://www.w3.org/2001/10/xml-exc-c14n#",
          "http://www.w3.org/2001/10/xml-exc-c14n#WithComments",
        ].includes(t.Algorithm)
    );
    if (!atLeastOneEnvelopedSignature || !allAlgorithmsAreValid) {
      throw samlNotValid("Transforms are not compliant");
    }
  };

  const validateSamlResponse = (samlResponse: string): SAMLResponse => {
    const xml = new XMLParser({
      ignoreDeclaration: true,
      removeNSPrefix: true,
      ignoreAttributes: false,
      attributeNamePrefix: "",
      isArray: (name) =>
        [
          "Assertion",
          "AudienceRestriction",
          "Audience",
          "AttributeValue",
        ].indexOf(name) !== -1,
    }).parse(samlResponse);

    const { success, data: saml, error } = SAMLResponse.safeParse(xml);

    if (!success) {
      throw samlNotValid(error.message);
    }
    if (!saml.Response) {
      throw samlNotValid("Response not found");
    }
    const response = saml.Response;
    if (!response.Signature) {
      throw samlNotValid("Missing Signature");
    }
    if (!response.Assertion || response.Assertion.length === 0) {
      throw samlNotValid("Missing Assertions");
    }
    const assertions = response.Assertion;
    const conditions = assertions
      .flatMap((a) => a.Conditions)
      .filter(filterUndefined);
    const audienceRestrictions = conditions
      .flatMap((c) => c.AudienceRestriction)
      .filter(filterUndefined);
    if (audienceRestrictions.length === 0) {
      throw samlNotValid("Missing Audience Restriction");
    }
    const notBeforeConditions = conditions
      .map((c) => c.NotBefore)
      .filter(filterUndefined);
    if (notBeforeConditions.length === 0) {
      throw samlNotValid("Missing Not Before Restrictions");
    }
    const notOnOrAfterConditions = conditions
      .map((c) => c.NotOnOrAfter)
      .filter(filterUndefined);
    if (notOnOrAfterConditions.length === 0) {
      throw samlNotValid("Missing Not On Or After Restrictions");
    }
    const attributeStatements = assertions
      .flatMap((a) => a.AttributeStatement)
      .filter(filterUndefined);
    if (attributeStatements.length === 0) {
      throw samlNotValid("Missing Attribute Statement");
    }
    const attributes = attributeStatements
      .flatMap((a) => a.Attribute)
      .filter(filterUndefined);
    if (attributes.length === 0) {
      throw samlNotValid("Missing Attributes");
    }
    const now = +Date();

    validateSignature(saml);

    if (notBeforeConditions.every((nb) => now > +new Date(nb))) {
      throw samlNotValid("Conditions notbefore are not compliant");
    }
    if (notOnOrAfterConditions.every((noa) => now < +new Date(noa))) {
      throw samlNotValid("Conditions NotOnOrAfter are not compliant");
    }

    if (
      !attributes.find(
        (a) =>
          a.Name === SUPPORT_LEVEL_NAME &&
          a.AttributeValue &&
          a.AttributeValue.some(
            (av) => av["#text"] && SUPPORT_LEVELS.includes(av["#text"])
          )
      )
    ) {
      throw samlNotValid("Support level is not compliant");
    }
    if (
      !audienceRestrictions
        .flatMap((ar) => ar.Audience)
        .some((aud) => aud === config.samlAudience)
    ) {
      throw samlNotValid("Conditions Audience is not compliant");
    }

    return saml;
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const buildSupportClaims = (selfcareId: string, tenant: tenantApi.Tenant) => {
    const organization = {
      id: selfcareId,
      name: tenant.name,
      roles: [
        {
          role: userRoles.SUPPORT_ROLE,
        },
      ],
    };

    const selfcareClaims = {
      [ORGANIZATION]: organization,
      [UID]: SUPPORT_USER_ID,
    };

    return {
      ...buildJwtCustomClaims(
        userRoles.SUPPORT_ROLE,
        tenant.id,
        selfcareId,
        tenant.externalId.origin,
        tenant.externalId.value
      ),
      ...selfcareClaims,
    };
  };

  return {
    getSessionToken: async (
      correlationId: string,
      identityToken: string,
      logger: Logger
    ): Promise<GetSessionTokenReturnType> => {
      logger.info("Received session token exchange request");

      const { sessionClaims, roles, selfcareId } = await readJwt(
        identityToken,
        logger
      );

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const headers = {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer ${serialized}`,
      };

      const tenantBySelfcareId =
        await tenantProcessClient.selfcare.getTenantBySelfcareId({
          params: { selfcareId },
          headers,
        });
      const tenantId = unsafeBrandId<TenantId>(tenantBySelfcareId.id);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      assertTenantAllowed(selfcareId, tenant.externalId.origin);

      const { limitReached, ...rateLimiterStatus } =
        await rateLimiter.rateLimitByOrganization(tenantId, logger);

      if (limitReached) {
        return {
          limitReached: true,
          sessionToken: undefined,
          rateLimitedTenantId: tenantId,
          rateLimiterStatus,
        };
      }

      const customClaims = buildJwtCustomClaims(
        roles,
        tenantId,
        selfcareId,
        tenant.externalId.origin,
        tenant.externalId.value
      );

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken({
          ...sessionClaims,
          ...customClaims,
        });

      return {
        limitReached: false,
        sessionToken,
        rateLimiterStatus,
      };
    },
    samlLoginCallback: async (
      correlationId: string,
      samlResponse: string
    ): Promise<string> => {
      validateSamlResponse(samlResponse);

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const headers = {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer ${serialized}`,
      };

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: config.pagoPaTenantId },
        headers,
      });

      const selfcareId = tenant.selfcareId;
      if (!selfcareId) {
        throw missingSelfcareId(config.pagoPaTenantId);
      }

      const claims = buildSupportClaims(selfcareId, tenant);

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken(
          claims,
          config.supportLandingJwtDuration
        );

      return sessionToken;
    },
    generateJwtFromSaml: async (
      correlationId: string,
      samlResponse: string,
      tenantId: string
    ): Promise<string> => {
      validateSamlResponse(samlResponse);

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const headers = {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer ${serialized}`,
      };

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: config.pagoPaTenantId },
        headers,
      });

      const selfcareId = tenant.selfcareId;
      if (!selfcareId) {
        throw missingSelfcareId(tenantId);
      }

      const claims = buildSupportClaims(selfcareId, tenant);

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken(
          claims,
          config.supportLandingJwtDuration
        );

      return sessionToken;
    },
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;

const filterUndefined = <T>(x: T | undefined): x is T => x !== undefined;
