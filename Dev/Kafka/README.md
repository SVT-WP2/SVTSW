# Kafka Dev Environment

## Prerequisites

- Install Docker Desktop, see documentation: https://docs.docker.com/desktop/setup/install/mac-install
- Alternatively you can install standalone Docker Compose: https://docs.docker.com/compose/install/

## Description

This folder contains the docker compose files to define and manage multi-container applications (--services--) needed to
run the main and dev svt software environment.

### `docker-compose.yaml`

docker compose file to run main environment. It defines and manages 4 serices:

- zookeeper service (kafka oordinator)
- kafka service with the following port mapping
  - 9091: internal docker network broker (kafka:9091)
  - 9092: ssh local tunneling broker (localhost:9092)
  - 9093: host network broker (svmithi02:9093)
- kafka-ui service
  - reached at localhost:8088 from host server
- db-agent service running with main environment configuration

### `docker-compose-dev.yaml`

Same as above but with dev enviroment configuration.

- zookeeper service (kafka oordinator)
- kafka service with the following port mapping
  - 9094: internal docker network broker (kafka:9094)
  - 9095: ssh local tunneling broker (localhost:9095)
  - 9096: host network broker (svmithi02:9096)
- kafka-ui service
  - reached at localhost:8087 from host server
- db-agent service running with dev environment configuration

## How to use

<!-- - Navigate to the current dir: `cd Dev/Kafka` -->

- start and attaches container for services, -d option starts the containers in the background and leaves them running.

  `docker compose -p <project_name> -f <path-to-docker-compose> up -d`

  e.g `docker compose -p main -f docker-compose.yaml up -d`

- stop/teardowm containers/services

  `docker compose -p <project_name> -f <path-to-docker-compose> down`

  e.g `docker compose -p main -f docker-compose.yaml down`

> [!ATTENTION]
> Since we would run both enviroment at the same time using a project name will avoid conflicts lfrom main and dev services because we use same images.

<!-- As a result you will have up and running -->
<!---->
<!-- - Kafka: `localhost:9092` -->
<!-- - Kafka UI: `localhost:8088` -->
