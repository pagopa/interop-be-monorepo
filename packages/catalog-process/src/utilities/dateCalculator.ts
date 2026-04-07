export function calculateArchivingEndDate(
  archivingStartDate: Date,
  days: 90 | 120
): Date {
  const endDate = new Date(archivingStartDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}
