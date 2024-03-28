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
  );
