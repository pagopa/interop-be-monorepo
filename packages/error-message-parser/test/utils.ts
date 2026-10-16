import { stringify } from "csv-stringify/sync";
import { randomUUID } from "node:crypto";
import { readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dataFolder = join(__dirname, "data");

export function createTestCsvFile(
  content: Record<string, string | undefined>[]
): string {
  const csv = stringify(content, {
    header: true,
  });

  const fileName = `test-${randomUUID()}.csv`;
  const filePath = join(dataFolder, fileName);

  writeFileSync(filePath, csv, "utf8");

  return filePath;
}

export function deleteCsvFiles(): void {
  const dataFolder = join(__dirname, "data");
  const files = readdirSync(dataFolder);
  for (const file of files) {
    if (file.endsWith(".csv") && file.startsWith("test-")) {
      unlinkSync(join(dataFolder, file));
    }
  }
}
