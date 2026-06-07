FROM ubuntu:24.04 AS db-agent-base

# Set the working directory in the container
WORKDIR /app

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    libcpprest-dev \
    libboost-all-dev \
    libssl-dev \
    cmake \
    pkg-config \
    jq

# POSGRESQL DEPS
RUN apt install curl ca-certificates gnupg2 wget -y
RUN sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
RUN wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg

RUN apt-get update
RUN apt install postgresql-17 libpq-dev -y
RUN apt-get install git-core -y

# KAFKA DEPS
RUN apt install librdkafka-dev -y

COPY ./.pgpass* /root/
RUN chmod 0600 /root/

COPY ./configs ./configs
COPY ./docker-entrypoint.sh .

FROM db-agent-base AS db-agent-build
ARG VERSION
ENV VERSION=${VERSION}
COPY ./common ./common
COPY ./app ./app
COPY ./compile.sh ./compile.sh
COPY ./VERSION ./VERSION

# Copy the source code into the container
RUN /bin/bash ./compile.sh

FROM db-agent-base AS db-agent
COPY --from=db-agent-build /app/install /app/svt-db-agent
RUN chmod +x ./docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
