import {
  catalogErrorCodes,
  delegationErrorCodes,
  tenantErrorCodes,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";

function getProcessCode(processName: string): string | undefined {
  return match(processName)
    .with("catalogProcess", () => "004")
    .with("delegationProcess", () => "010")
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
    .with("tenantProcess", () => {
      if (errorCode in tenantErrorCodes) {
        return tenantErrorCodes[errorCode as keyof typeof tenantErrorCodes];
      }
      return undefined;
    })
    .otherwise(() => undefined);
  return errorCodeNumber ? `${processCode}-${errorCodeNumber}` : undefined;
}
