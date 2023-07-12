INSERT INTO
  "event"(
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