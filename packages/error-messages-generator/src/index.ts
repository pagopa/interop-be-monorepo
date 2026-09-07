import * as XLSX from "xlsx";
import { z } from "zod";

const schema = z.object({
  language: z.string(),
  errors: z.array(
    z.object({
      scope: z.string(),
      errorCode: z.string(),
      message: z.string(),
      scopeCode: z.string(),
    }),
  ),
});

type Schema = z.infer<typeof schema>;

function getScopeCode(scope: string): string {
  if (scope === "CatalogProcess") {
    return "004";
  }
  if (scope === "anotherScope") {
    return "005";
  }
  return "";
}

function getErrors(): Schema[] {
  const workbook = XLSX.readFile("input.xlsx");

  const out: Schema[] = [];

  console.log(workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    if (!["it", "en"].includes(sheetName)) {
      continue;
    }
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
    });

    const errors: Schema["errors"] = [];
    for (const row of rows.slice(1)) {
      const [scope, errorCode, message] = row as string[];
      errors.push({
        scope,
        errorCode,
        message,
        scopeCode: getScopeCode(scope),
      });
    }
    out.push({
      language: sheetName,
      errors,
    });
  }
  return out;
}

const errors = getErrors();
console.log(JSON.stringify(errors, null, 2));
