# Datalake Interface Exporter

This consumer:

- listens for events that publish a new version of an eservice
- copies the new interface file for the new version to the target S3 bucket

This target S3 bucket replicates the files to a bucket owned by Datalake.
