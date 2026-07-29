export const ESERVICE_INSTANCE_NAME_SEPARATOR = " - ";

/**
 * Normalizes the instance label: empty spaces are removed and an empty string
 * is treated as undefined.
 * - instanceLabel: maxLength 12
 */
export const parseEServiceInstanceLabel = (
  instanceLabel: string | undefined
): string | undefined => {
  const trimmedInstanceLabel = instanceLabel?.trim();
  return trimmedInstanceLabel && trimmedInstanceLabel.length > 0
    ? trimmedInstanceLabel
    : undefined;
};

/**
 * Builds the instance name from the template name and optional instance label.
 * - templateName: maxLength 45
 * - separator: 3 characters
 * - instanceLabel: maxLength 12
 * - eservice name (result): maxLength 60
 *
 * The instance label is normalized with `parseEServiceInstanceLabel`.
 */
export const buildEServiceInstanceName = ({
  templateName,
  instanceLabel,
}: {
  templateName: string;
  instanceLabel: string | undefined;
}): string => {
  const parsedInstanceLabel = parseEServiceInstanceLabel(instanceLabel);
  return parsedInstanceLabel
    ? `${templateName}${ESERVICE_INSTANCE_NAME_SEPARATOR}${parsedInstanceLabel}`
    : templateName;
};
