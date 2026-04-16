export function calculateArchivingEndDate(
  archivingStartDate: Date,
  days: 90 | 120
): Date {
  const endDate = new Date(archivingStartDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}

export function toOnlyDate(
  date: Date,
): String {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isSameDay(
  firstDate: Date,
  secondDate: Date
): boolean {
  return toOnlyDate(firstDate) === toOnlyDate(secondDate);
}
