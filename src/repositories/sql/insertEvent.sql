INSERT INTO
  "event"(
    "stream_id",
    "version",
    "type",
    "data",
    "meta"
  )
VALUES
  (
    $(stream_id),
    $(version),
    $(type),
    $(data),
    $(meta)
  );