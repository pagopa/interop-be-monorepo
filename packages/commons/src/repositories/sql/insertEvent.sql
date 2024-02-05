INSERT INTO
  "events"(
    "stream_id",
    "version",
    "type",
    "event_version",
    "data"
  )
VALUES
  (
    $(stream_id),
    $(version),
    $(type),
    $(event_version),
    $(data)
  );
