create table event ( 
    sequence_num bigserial NOT NULL,

    stream_id varchar(128) NOT NULL,
    version bigint NOT NULL,

    type varchar(128) NOT NULL,
    data jsonb NOT NULL,
    meta jsonb NOT NULL,

    log_date timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (sequence_num),
    UNIQUE (stream_id, version)
);
