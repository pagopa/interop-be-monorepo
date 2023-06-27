import path from "path";
import { fileURLToPath } from "url";
import pgPromise from "pg-promise";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

function sql(file: string): pgPromise.QueryFile {
  const fullPath: string = path.join(dirname, file);

  const options: pgPromise.IQueryFileOptions = {
    minify: true,
  };

  const query = new pgPromise.QueryFile(fullPath, options);

  if (query.error) {
    console.error(query.error);
  }

  return query;
}

export const insertEvent = sql("insertEvent.sql");
export const checkEventVersionExists = sql("checkEventVersionExists.sql");
