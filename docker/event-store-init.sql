create table event (
    sequence_num bigserial NOT NULL,

    stream_id uuid NOT NULL,
    version bigint NOT NULL,

    type text NOT NULL,
    data bytea NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);
