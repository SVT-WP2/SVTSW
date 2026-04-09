FROM ubuntu:24.04

# Set the working directory in the container
WORKDIR /app

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    libcpprest-dev \
    libboost-all-dev \
    libssl-dev \
    cmake \
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

# Copy the source code into the container
COPY . .
RUN chmod +x /app/docker-entrypoint.sh
RUN bash ./compile.sh

EXPOSE 6600
EXPOSE 9095

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/configs/SvtDbAgent_config-local.json"]




