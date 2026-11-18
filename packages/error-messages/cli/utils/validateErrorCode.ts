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
import { commonErrorCodes } from "pagopa-interop-models";
import { match } from "ts-pattern";

import { ProcessName } from "../models/index.js";

type ErrorName =
  | keyof typeof commonErrorCodes
  | keyof typeof agreementErrorCodes
  | keyof typeof attributeRegistryErrorCodes
  | keyof typeof authorizationErrorCodes
  | keyof typeof bffErrorCodes
  | keyof typeof catalogErrorCodes
  | keyof typeof delegationErrorCodes
  | keyof typeof eserviceTemplateErrorCodes
  | keyof typeof notificationConfigErrorCodes
  | keyof typeof purposeErrorCodes
  | keyof typeof purposeTemplateErrorCodes
  | keyof typeof tenantErrorCodes;

interface ErrorCodeAndProcessCode {
  errorName: ErrorName;
  processName: ProcessName;
}

function getProcessName(processName: string): ProcessName | undefined {
  return match<string, ProcessName | undefined>(processName)
    .with("002", () => "agreement")
    .with("003", () => "attributeRegistry")
    .with("006", () => "authorization")
    .with("001", () => "catalog")
    .with("010", () => "delegation")
    .with("011", () => "eserviceTemplate")
    .with("014", () => "notificationConfig")
    .with("004", () => "purpose")
    .with("015", () => "purposeTemplate")
    .with("005", () => "tenant")
    .with("008", () => "bff")
    .otherwise(() => undefined);
}

export function getErrorCodeAndProcessCode(
  value: string,
  errorNameGiven: string
): ErrorCodeAndProcessCode {
  const [processCode, errorCode] = value.split("-");
  const processName = getProcessName(processCode);
  if (processName === undefined) {
    throw new Error(`Process code ${processCode} not found`);
  }
  const findErrorName = <T extends Record<string, string>>(
    codes: T
  ): keyof T | undefined =>
    (Object.keys(codes) as Array<keyof T>).find(
      (name) => codes[name] === errorCode
    );

  const processErrorName = match(processName)
    .with("agreement", () => findErrorName(agreementErrorCodes))
    .with("attributeRegistry", () => findErrorName(attributeRegistryErrorCodes))
    .with("authorization", () => findErrorName(authorizationErrorCodes))
    .with("catalog", () => findErrorName(catalogErrorCodes))
    .with("delegation", () => findErrorName(delegationErrorCodes))
    .with("eserviceTemplate", () => findErrorName(eserviceTemplateErrorCodes))
    .with("notificationConfig", () =>
      findErrorName(notificationConfigErrorCodes)
    )
    .with("purpose", () => findErrorName(purposeErrorCodes))
    .with("purposeTemplate", () => findErrorName(purposeTemplateErrorCodes))
    .with("tenant", () => findErrorName(tenantErrorCodes))
    .with("bff", () => findErrorName(bffErrorCodes))
    .exhaustive();

  const errorName: ErrorName | undefined =
    processErrorName ?? findErrorName(commonErrorCodes);

  if (errorName === undefined) {
    throw new Error(
      `No error code found for process ${processName} and error code ${errorCode}`
    );
  }

  if (errorName !== errorNameGiven) {
    throw new Error(
      `Error code ${errorCode} matches ${errorName} but it was expected to be ${errorNameGiven}`
    );
  }

  return { errorName, processName };
}
