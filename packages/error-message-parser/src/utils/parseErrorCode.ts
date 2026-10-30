import {
  agreementErrorCodes,
  attributeRegistryErrorCodes,
  authorizationErrorCodes,
  bffErrorCodes,
  catalogErrorCodes,
  delegationErrorCodes,
  eserviceTemplateErrorCodes,
  notificationConfigErrorCodes,
  purposeErrorCodes,
  purposeTemplateErrorCodes,
  tenantErrorCodes,
} from "pagopa-interop-commons";
import {
  commonErrorCodes,
  serviceErrorCode,
  serviceName,
} from "pagopa-interop-models";

const processErrors = [
  { service: serviceName.AGREEMENT_PROCESS, errors: agreementErrorCodes },
  {
    service: serviceName.ATTRIBUTE_REGISTRY_PROCESS,
    errors: attributeRegistryErrorCodes,
  },
  {
    service: serviceName.AUTHORIZATION_PROCESS,
    errors: authorizationErrorCodes,
  },
  { service: serviceName.BACKEND_FOR_FRONTEND, errors: bffErrorCodes },
  { service: serviceName.CATALOG_PROCESS, errors: catalogErrorCodes },
  { service: serviceName.DELEGATION_PROCESS, errors: delegationErrorCodes },
  {
    service: serviceName.ESERVICE_TEMPLATE_PROCESS,
    errors: eserviceTemplateErrorCodes,
  },
  {
    service: serviceName.NOTIFICATION_CONFIG_PROCESS,
    errors: notificationConfigErrorCodes,
  },
  { service: serviceName.PURPOSE_PROCESS, errors: purposeErrorCodes },
  {
    service: serviceName.PURPOSE_TEMPLATE_PROCESS,
    errors: purposeTemplateErrorCodes,
  },
  { service: serviceName.TENANT_PROCESS, errors: tenantErrorCodes },
];

function normalizeProcess(process: string): string {
  const normalized = process
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "")
    .replace(/process$/, "");
  return normalized === "bff" ? "backendforfrontend" : normalized;
}

export function getErrorCode(process: string, error: string): string | null {
  const normalized = normalizeProcess(process);
  const configuration = processErrors.find(
    ({ service }) => normalizeProcess(service) === normalized
  );
  if (!configuration) {
    return null;
  }

  const entry = [
    ...Object.entries(commonErrorCodes),
    ...Object.entries(configuration.errors),
  ].find(([name]) => name === error);

  return entry
    ? `${serviceErrorCode[configuration.service]}-${entry[1]}`
    : null;
}
