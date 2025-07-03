import { InternalError } from "pagopa-interop-models";

type InAppNotificationDispatcherErrorCode = "tenantNotFound";

export class InAppNotificationDispatcherError extends InternalError<InAppNotificationDispatcherErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: InAppNotificationDispatcherErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function tenantNotFound(
  tenantId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}
