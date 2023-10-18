INSERT INTO
  "events"(
    "stream_id",
    "version",
    "type",
    "data"
  )
VALUES
  (
    $(stream_id),
    $(version),
    $(type),
    $(data)
  );
