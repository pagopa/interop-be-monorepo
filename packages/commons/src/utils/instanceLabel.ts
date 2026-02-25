/**
 * Builds the instance name from the template name and optional instance label.
 * - instanceLabel: maxLength 12
 * - templateName: maxLength 45
 * - separator " - ": 3 characters
 * - eservice name (result): maxLength 60
 */
export const buildInstanceName = (
  templateName: string,
  instanceLabel: string | undefined
): string =>
  instanceLabel ? `${templateName} - ${instanceLabel}` : templateName;
