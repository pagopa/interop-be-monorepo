INSERT INTO
  "events"(
    "stream_id",
    "correlation_id",
    "version",
    "type",
    "event_version",
    "data"
  )
VALUES
  (
    $(stream_id),
    $(correlation_id),
    $(version),
    $(type),
    $(event_version),
    $(data)
  );
