FROM amazon/dynamodb-local:2.6.1

USER root
COPY entrypoint.sh /usr/local/bin/dynamodb-local-entrypoint
RUN chmod +x /usr/local/bin/dynamodb-local-entrypoint \
    && cp DynamoDBLocal_lib/libsqlite4java-linux-amd64.so \
      DynamoDBLocal_lib/libsqlite4java-linux-x86_64.so
USER dynamodblocal

ENTRYPOINT ["/usr/local/bin/dynamodb-local-entrypoint"]
