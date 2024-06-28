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
  SELFCARE_ID_CLAIM,
  SessionClaims,
  SessionTokenGenerator,
  USER_ROLES,
  decodeJwtToken,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { config } from "../utilities/config.js";
import {
  missingClaim,
  missingSelfcareId,
  samlNotValid,
  unknownTenantOrigin,
} from "../utilities/errors.js";
import { genericError } from "pagopa-interop-models";
import { XMLParser } from "fast-xml-parser";
import { SAMLResponse, Tenant } from "../model/types.js";

const SUPPORT_LEVELS = ["L2", "L3"];
const SUPPORT_LEVEL_NAME = "supportLevel";
const SUPPORT_ROLE = "support";
const UID = "uid";
const SUPPORT_USER_ID = "5119b1fa-825a-4297-8c9c-152e055cabca";

export function authorizationServiceBuilder(
  interopTokenGenerator: InteropTokenGenerator,
  sessionTokenGenerator: SessionTokenGenerator,
  tenantProcessClient: PagoPAInteropBeClients["tenantProcessClient"],
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
      throw genericError("Invalid token");
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
      throw unknownTenantOrigin(selfcareId);
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

    if (!saml.Response) throw samlNotValid("Response not found");
    const response = saml.Response;
    if (!response.Signature) throw samlNotValid("Missing Signature");
    if (!response.Assertion || response.Assertion.length === 0)
      throw samlNotValid("Missing Assertions");
    const assertions = response.Assertion;
    const conditions = assertions
      .flatMap((a) => a.Conditions)
      .filter(filterUndefined);
    const audienceRestrictions = conditions
      .flatMap((c) => c.AudienceRestriction)
      .filter(filterUndefined);
    if (audienceRestrictions.length === 0)
      throw samlNotValid("Missing Audience Restriction");
    const notBeforeConditions = conditions
      .map((c) => c.NotBefore)
      .filter(filterUndefined);
    if (notBeforeConditions.length === 0)
      throw samlNotValid("Missing Not Before Restrictions");
    const notOnOrAfterConditions = conditions
      .map((c) => c.NotOnOrAfter)
      .filter(filterUndefined);
    if (notOnOrAfterConditions.length === 0)
      throw samlNotValid("Missing Not On Or After Restrictions");
    const attributeStatements = assertions
      .flatMap((a) => a.AttributeStatement)
      .filter(filterUndefined);
    if (attributeStatements.length === 0)
      throw samlNotValid("Missing Attribute Statement");
    const attributes = attributeStatements
      .flatMap((a) => a.Attribute)
      .filter(filterUndefined);
    if (attributes.length === 0) throw samlNotValid("Missing Attributes");
    const now = +Date();
    //TODO SAML signature profiler validation
    if (notBeforeConditions.every((nb) => now > +new Date(nb)))
      throw samlNotValid("Conditions notbefore are not compliant");
    if (notOnOrAfterConditions.every((noa) => now < +new Date(noa)))
      throw samlNotValid("Conditions NotOnOrAfter are not compliant");

    if (
      !attributes.find(
        (a) =>
          a.Name === SUPPORT_LEVEL_NAME &&
          a.AttributeValue &&
          a.AttributeValue.some(
            (av) => av["#text"] && SUPPORT_LEVELS.includes(av["#text"])
          )
      )
    )
      throw samlNotValid("Support level is not compliant");
    if (
      !audienceRestrictions
        .flatMap((ar) => ar.Audience)
        .some((aud) => aud === config.samlAudience)
    )
      throw samlNotValid("Conditions Audience is not compliant");

    return saml;
  };

  const buildSupportClaims = (selfcareId: string, tenant: Tenant) => {
    const organization = {
      id: selfcareId,
      name: tenant.name,
      roles: [
        {
          role: SUPPORT_ROLE,
        },
      ],
    };

    const selfcareClaims = {
      [ORGANIZATION]: organization,
      [UID]: SUPPORT_USER_ID,
    };

    return {
      ...buildJwtCustomClaims(
        SUPPORT_ROLE,
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
    ) => {
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
        await tenantProcessClient.getTenantBySelfcareId({
          params: { selfcareId },
          headers,
        });
      const tenantId = tenantBySelfcareId.id;

      const tenant = await tenantProcessClient.getTenant({
        params: { id: tenantId },
        headers,
      });

      assertTenantAllowed(selfcareId, tenant.externalId.origin);

      const customClaims = buildJwtCustomClaims(
        roles,
        tenantId,
        selfcareId,
        tenant.externalId.origin,
        tenant.externalId.value
      );

      return sessionTokenGenerator.generate({
        ...sessionClaims,
        ...customClaims,
      });
    },
    samlLoginCallback: async (
      correlationId: string,
      samlResponse: string
    ): Promise<string> => {
      validateSamlResponse(samlResponse);

      const { serialized } =
        await interopTokenGenerator.generateInternalToken(); //TODO support user id

      const headers = {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer ${serialized}`,
      };

      const tenant = await tenantProcessClient.getTenant({
        params: { id: config.pagoPaTenantId },
        headers,
      });

      const selfcareId = tenant.selfcareId;
      if (!selfcareId) {
        throw missingSelfcareId(config.pagoPaTenantId);
      }

      const claims = buildSupportClaims(selfcareId, tenant);

      return sessionTokenGenerator.generate(claims); //TODO different validity for support supportLandingJwtDuration
    },
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;

const filterUndefined = <T>(x: T | undefined): x is T => x !== undefined;
