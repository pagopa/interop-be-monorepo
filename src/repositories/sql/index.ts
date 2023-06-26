import path from "path";
import { IQueryFileOptions, QueryFile } from "pg-promise";

function sql(file: string): QueryFile {
  const fullPath: string = path.join(__dirname, file);

  const options: IQueryFileOptions = {
    minify: true,
  };

  const query: QueryFile = new QueryFile(fullPath, options);

  if (query.error) {
    console.error(query.error);
  }

  return query;
}

export const insertEvent = sql("insertEvent.sql");
export const maxEventVersion = sql("maxEventVersion.sql");
