import {
  agreementErrorCodes,
  attributeRegistryErrorCodes,
  authorizationErrorCodes,
  catalogErrorCodes,
  delegationErrorCodes,
  eserviceTemplateErrorCodes,
  notificationConfigErrorCodes,
  purposeErrorCodes,
  purposeTemplateErrorCodes,
  tenantErrorCodes,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";

function getProcessCode(processName: string): string | undefined {
  return match(processName)
    .with("agreementProcess", () => "002")
    .with("attributeRegistryProcess", () => "003")
    .with("authorizationProcess", () => "006")
    .with("catalogProcess", () => "001")
    .with("delegationProcess", () => "010")
    .with("eserviceTemplateProcess", () => "011")
    .with("notificationConfigProcess", () => "014")
    .with("purposeProcess", () => "004")
    .with("purposeTemplateProcess", () => "015")
    .with("tenantProcess", () => "005")
    .otherwise(() => undefined);
}

export function getErrorCode(
  processName: string,
  errorCode: string
): string | undefined {
  const processCode = getProcessCode(processName);
  if (!processCode) {
    return undefined;
  }
  const errorCodeNumber = match(processName)
    .with("agreementProcess", () => {
      if (errorCode in agreementErrorCodes) {
        return agreementErrorCodes[
          errorCode as keyof typeof agreementErrorCodes
        ];
      }
      return undefined;
    })
    .with("attributeRegistryProcess", () => {
      if (errorCode in attributeRegistryErrorCodes) {
        return attributeRegistryErrorCodes[
          errorCode as keyof typeof attributeRegistryErrorCodes
        ];
      }
      return undefined;
    })
    .with("authorizationProcess", () => {
      if (errorCode in authorizationErrorCodes) {
        return authorizationErrorCodes[
          errorCode as keyof typeof authorizationErrorCodes
        ];
      }
      return undefined;
    })
    .with("catalogProcess", () => {
      if (errorCode in catalogErrorCodes) {
        return catalogErrorCodes[errorCode as keyof typeof catalogErrorCodes];
      }
      return undefined;
    })
    .with("delegationProcess", () => {
      if (errorCode in delegationErrorCodes) {
        return delegationErrorCodes[
          errorCode as keyof typeof delegationErrorCodes
        ];
      }
      return undefined;
    })
    .with("eserviceTemplateProcess", () => {
      if (errorCode in eserviceTemplateErrorCodes) {
        return eserviceTemplateErrorCodes[
          errorCode as keyof typeof eserviceTemplateErrorCodes
        ];
      }
      return undefined;
    })
    .with("notificationConfigProcess", () => {
      if (errorCode in notificationConfigErrorCodes) {
        return notificationConfigErrorCodes[
          errorCode as keyof typeof notificationConfigErrorCodes
        ];
      }
      return undefined;
    })
    .with("purposeProcess", () => {
      if (errorCode in purposeErrorCodes) {
        return purposeErrorCodes[errorCode as keyof typeof purposeErrorCodes];
      }
      return undefined;
    })
    .with("purposeTemplateProcess", () => {
      if (errorCode in purposeTemplateErrorCodes) {
        return purposeTemplateErrorCodes[
          errorCode as keyof typeof purposeTemplateErrorCodes
        ];
      }
      return undefined;
    })
    .with("tenantProcess", () => {
      if (errorCode in tenantErrorCodes) {
        return tenantErrorCodes[errorCode as keyof typeof tenantErrorCodes];
      }
      return undefined;
    })
    .otherwise(() => undefined);
  return errorCodeNumber ? `${processCode}-${errorCodeNumber}` : undefined;
}
