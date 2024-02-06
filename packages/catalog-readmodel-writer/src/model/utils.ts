// Temporary workaround
export const safeParserDate = (date: bigint | undefined): Date => {
  if (!date) {
    throw new Error(
      "createdAt field is required in EService definition but is not provided in serialized byte array events"
    );
  }
  return new Date(Number(date));
};
