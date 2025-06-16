// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function inAppNotificationServiceBuilder() {
  return {};
}

export type InAppNotificationService = ReturnType<
  typeof inAppNotificationServiceBuilder
>;
