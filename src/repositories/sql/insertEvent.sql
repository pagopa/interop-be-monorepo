INSERT INTO
  "event"
VALUES
  (
    $(stream_id),
    $(version),
    $(type),
    $(data),
    $(meta),
    $(log_date),
  );