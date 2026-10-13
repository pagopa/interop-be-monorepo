import {
  ENVIRONMENT_KEYS,
  ENVIRONMENT_RULES,
  LOCAL_ENDPOINTS,
  PACKAGE_NAMES,
} from "./constants.js";

export const localEnvironmentOverrides: Readonly<NodeJS.ProcessEnv> = {
  NODE_ENV: ENVIRONMENT_RULES.nodeEnvironment,
  FRONTEND_BASE_URL: LOCAL_ENDPOINTS.frontend,
  SELFCARE_V2_URL: LOCAL_ENDPOINTS.selfcare,
  SELFCARE_V2_API_KEY: "local-selfcare-key",
  DYNAMO_DB_ENDPOINT: LOCAL_ENDPOINTS.dynamodb,
  WELL_KNOWN_URLS: LOCAL_ENDPOINTS.jwks,
  AWS_ACCESS_KEY_ID: "testawskey",
  AWS_SECRET_ACCESS_KEY: "testawssecret",
  AWS_REGION: "eu-south-1",
  AWS_CONFIG_FILE: "/dev/null",
  AWS_SHARED_CREDENTIALS_FILE: "/dev/null",
  AWS_EC2_METADATA_DISABLED: "true",
  [ENVIRONMENT_KEYS.ignoreConfiguredEndpoints]: "false",
  AWS_ENDPOINT_URL: LOCAL_ENDPOINTS.localstack,
  AWS_ENDPOINT_URL_KMS: LOCAL_ENDPOINTS.localstack,
  AWS_ENDPOINT_URL_DYNAMODB: LOCAL_ENDPOINTS.dynamodb,
  AWS_ENDPOINT_URL_S3: LOCAL_ENDPOINTS.s3,
  AWS_ENDPOINT_URL_SQS: LOCAL_ENDPOINTS.sqs,
  AWS_ENDPOINT_URL_SESV2: LOCAL_ENDPOINTS.ses,
  S3_CUSTOM_SERVER: "true",
  S3_SERVER_HOST: "http://localhost",
  S3_SERVER_PORT: "9000",
  NODE_OPTIONS: "--max-old-space-size=192",
  KAFKA_DISABLE_AWS_IAM_AUTH: "true",
  PRODUCER_KAFKA_DISABLE_AWS_IAM_AUTH: "true",
};

export const packageEnvironmentOverrides: Readonly<
  Record<string, NodeJS.ProcessEnv>
> = {
  [PACKAGE_NAMES.authorizationServer]: {
    PORT: "4700",
    GENERATED_INTEROP_TOKEN_M2M_AUDIENCE: "dev.interop.pagopa.it/m2m",
  },
  "pagopa-interop-certified-email-sender": {
    PEC_SMTP_PORT: "1025",
    PEC_SMTP_SECURE: "false",
  },
  "pagopa-interop-documents-generator": {
    PURPOSE_TEMPLATE_PROCESS_URL: LOCAL_ENDPOINTS.purposeTemplateProcess,
  },
  "pagopa-interop-email-digest-dispatcher": {
    BFF_URL: LOCAL_ENDPOINTS.backendForFrontend,
  },
  "pagopa-interop-email-notification-dispatcher": {
    BFF_URL: LOCAL_ENDPOINTS.backendForFrontend,
  },
  "pagopa-interop-email-scheduled-notification-dispatcher": {
    BFF_URL: LOCAL_ENDPOINTS.backendForFrontend,
  },
  "pagopa-interop-in-app-notification-dispatcher": {
    INTEROP_FE_BASE_URL: LOCAL_ENDPOINTS.frontend,
  },
  "pagopa-interop-m2m-event-dispatcher": {
    PURPOSE_TEMPLATE_TOPIC: "event-store.purpose_template.events",
  },
  "pagopa-interop-m2m-gateway-v3": { DPOP_CACHE_TABLE: "dpop-cache" },
  "pagopa-interop-notification-email-sender": {
    INTEROP_FE_BASE_URL: LOCAL_ENDPOINTS.frontend,
  },
  "pagopa-interop-notifier-seeder": {
    AGREEMENT_TOPIC: "event-store.agreement.events",
    AUTHORIZATION_TOPIC: "event-store.authorization.events",
  },
  "pagopa-interop-private-certified-attributes-importer": {
    ATTRIBUTE_PROCESS_URL: LOCAL_ENDPOINTS.attributeProcess,
  },
};
