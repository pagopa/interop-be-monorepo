-- Development and test database identities.
CREATE ROLE contact_reader LOGIN PASSWORD 'contact_reader';
CREATE ROLE contact_writer LOGIN PASSWORD 'contact_writer';
GRANT USAGE ON SCHEMA contact_data TO contact_reader, contact_writer;
GRANT SELECT (id, email) ON contact_data.contact TO contact_reader;
GRANT SELECT (id, email), INSERT ON contact_data.contact TO contact_writer;
