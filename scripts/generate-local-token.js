const { randomUUID } = require("crypto");
const { KMSClient, SignCommand } = require("@aws-sdk/client-kms");

// ============================================================================
// simply launch this script with `node scripts/generate-local-token.js`
// to generate a signed JWT token using local-kms
// ============================================================================

const LOCAL_KMS_ENDPOINT = "http://localhost:4566";
const LOCAL_REGION = "eu-south-1";

// KMS Key IDs from local-kms-seed/seed.yaml    
const LOCAL_KEY_IDS = {
  key: "ffcc9b5b-4612-49b1-9374-9d203a3834f2",
};

// ============================================================================
// CONFIGURATION - Change these values for your local development needs
// ============================================================================

// Token role - Possible values: "admin", "api", "security", "api,security", "m2m", "m2m-admin", "maintenance", "internal"
const TOKEN_ROLE = "admin";

// Token duration in seconds (default: 86400 = 24 hours)
const TOKEN_DURATION_SECONDS = 86400;

// Organization ID
const ORGANIZATION_ID = "69e2865e-65ab-4e48-a638-2037a9ee2ee7"; // PagoPA S.p.A.

// User ID (used for admin and m2m-admin roles)
const USER_ID = "f07ddb8f-17f9-47d4-b31e-35d1ac10e521";

// Selfcare ID
const SELFCARE_ID = "1962d21c-c701-4805-93f6-53a877898756";

// payload constants
const COMMON_EXTERNAL_ID = {
  origin: "IPA",
  value: "5N2TR557",
};

const COMMON_ORGANIZATION_BASE = {
  name: "PagoPA S.p.A.",
  fiscal_code: "15376371009",
  ipaCode: "5N2TR557",
};

const COMMON_USER_INFO = {
  name: "Mario",
  family_name: "Rossi",
  email: "m.rossi@psp.it",
};

const AUDIENCES = {
  ui: "dev.interop.pagopa.it/ui",
  m2m: "dev.interop.pagopa.it/m2m",
  internal: "dev.interop.pagopa.it/internal",
};

function getSessionTokenHeader(kid) {
  return {
    alg: "RS256",
    typ: "at+jwt",
    kid,
    use: "sig",
  };
}

function createOrganization(organizationId, roles) {
  return {
    id: organizationId,
    ...COMMON_ORGANIZATION_BASE,
    roles,
  };
}

function createUIPayload(basePayload, userRoles, organizationId, roles, uid) {
  return {
    ...basePayload,
    aud: AUDIENCES.ui,
    externalId: COMMON_EXTERNAL_ID,
    "user-roles": userRoles,
    selfcareId: SELFCARE_ID,
    organizationId,
    organization: createOrganization(organizationId, roles),
    uid,
    ...COMMON_USER_INFO,
  };
}

function getSessionTokenPayload(role, sessionDuration) {
  const issuedAt = Math.round(new Date().getTime() / 1000);
  const issuer = "dev.interop.pagopa.it";

  const basePayload = {
    iss: issuer,
    nbf: issuedAt,
    iat: issuedAt,
    exp: issuedAt + sessionDuration,
    jti: randomUUID(),
  };

  switch (role) {
    case "admin":
      return createUIPayload(
        basePayload,
        "admin",
        ORGANIZATION_ID,
        [{ partyRole: "MANAGER", role: "admin" }],
        USER_ID
      );

    case "api":
      return createUIPayload(
        basePayload,
        "api",
        ORGANIZATION_ID,
        [{ partyRole: "MANAGER", role: "api" }],
        randomUUID()
      );

    case "security":
      return createUIPayload(
        basePayload,
        "security",
        ORGANIZATION_ID,
        [{ partyRole: "MANAGER", role: "security" }],
        randomUUID()
      );

    case "api,security":
      return createUIPayload(
        basePayload,
        "api,security",
        ORGANIZATION_ID,
        [
          { partyRole: "MANAGER", role: "api" },
          { partyRole: "MANAGER", role: "security" },
        ],
        randomUUID()
      );

    case "m2m":
      return {
        ...basePayload,
        aud: AUDIENCES.m2m,
        role: "m2m",
        organizationId: ORGANIZATION_ID,
        client_id: randomUUID(),
        sub: randomUUID(),
      };

    case "m2m-admin":
      return {
        ...basePayload,
        aud: AUDIENCES.m2m,
        role: "m2m-admin",
        organizationId: ORGANIZATION_ID,
        adminId: USER_ID,
        client_id: randomUUID(),
        sub: randomUUID(),
      };

    case "maintenance":
      return {
        ...basePayload,
        aud: AUDIENCES.internal,
        role: "maintenance",
        sub: randomUUID(),
      };

    case "internal":
      return {
        ...basePayload,
        aud: AUDIENCES.internal,
        role: "internal",
        sub: randomUUID(),
      };

    default:
      throw new Error(`Unsupported role: ${role}`);
  }
}

function getUnsignedToken(header, payload) {
  const encodedHeader = b64UrlEncode(JSON.stringify(header));
  const encodedPayload = b64UrlEncode(JSON.stringify(payload));
  return `${encodedHeader}.${encodedPayload}`;
}

function b64ByteUrlEncode(b) {
  return bufferB64UrlEncode(Buffer.from(b));
}

function b64UrlEncode(str) {
  return bufferB64UrlEncode(Buffer.from(str, "binary"));
}

function bufferB64UrlEncode(b) {
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function signToken(kid, unsignedToken) {
  const kmsClient = new KMSClient({
    region: LOCAL_REGION,
    endpoint: LOCAL_KMS_ENDPOINT,
    credentials: {
      accessKeyId: "local",
      secretAccessKey: "local",
    },
  });

  const signCommand = new SignCommand({
    KeyId: kid,
    Message: new TextEncoder().encode(unsignedToken),
    SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
  });

  const response = await kmsClient.send(signCommand);
  const responseSignature = response.Signature;

  if (!responseSignature) {
    throw new Error("JWT Signature failed. Empty signature returned");
  }

  const kmsSignature = b64ByteUrlEncode(responseSignature);
  return `${unsignedToken}.${kmsSignature}`;
}

async function generateLocalToken(role, sessionDuration) {
  const kid = LOCAL_KEY_IDS.key;

  const sessionTokenHeader = getSessionTokenHeader(kid);
  const sessionTokenPayload = getSessionTokenPayload(role, sessionDuration);

  const unsignedToken = getUnsignedToken(
    sessionTokenHeader,
    sessionTokenPayload
  );

  const signedToken = await signToken(kid, unsignedToken);

  return signedToken;
}

async function main() {
  try {
    const token = await generateLocalToken(TOKEN_ROLE, TOKEN_DURATION_SECONDS);

    console.log("\n✅ Token generated successfully!");
    console.log("\nToken details:");
    console.log(`  Role: ${TOKEN_ROLE}`);
    console.log(`  Organization ID: ${ORGANIZATION_ID}`);
    console.log(`  Duration: ${TOKEN_DURATION_SECONDS} seconds`);
    console.log("\nToken:");
    console.log(token);
    console.log("\nYou can add this to your collections/.env file:");
    console.log(`JWT=${token}`);
  } catch (error) {
    console.error("❌ Error generating token:", error);
    process.exit(1);
  }
}

main();
