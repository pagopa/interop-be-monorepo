export const insertEvent = `
  INSERT INTO
    "events"(
      "stream_id",
      "version",
      "correlation_id",
      "type",
      "event_version",
      "data"
    )
  VALUES
    (
      $(stream_id),
      $(version),
      $(correlation_id),
      $(type),
      $(event_version),
      $(data)
    )
`;

export const checkEventVersionExists = `
  SELECT 1
  FROM "events"
  WHERE
      stream_id = $(stream_id)
      AND "version" = $(version)
`;
