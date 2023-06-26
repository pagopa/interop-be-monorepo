INSERT INTO
  "event"(
    "stream_id",
    "version",
    "type",
    "data",
    "meta",
    "log_date"
  )
VALUES
  (
    $(stream_id),
    $(version),
    $(type),
    $(data),
    $(meta),
    $(log_date)
  );