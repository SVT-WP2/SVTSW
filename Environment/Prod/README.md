# Prod Environment

Docker Compose stacks for the SVTSW **production** environment.

| File | Purpose |
| ---- | ------- |
| [`docker-compose-kafka-prod.yml`](docker-compose-kafka-prod.yml) | Kafka broker (KRaft) + Kafka UI |
| [`svt.kafka--prod.service`](svt.kafka--prod.service) | systemd unit that runs the Kafka stack |

## Run with Docker Compose

```bash
docker compose -p svt-kafka--prod -f docker-compose-kafka-prod.yml up -d
docker compose -p svt-kafka--prod -f docker-compose-kafka-prod.yml ps
docker compose -p svt-kafka--prod -f docker-compose-kafka-prod.yml down
```

Kafka UI is then available on port **8088**.

## Large Kafka messages

Kafka caps a single message at **1 MB** by default, which list replies (wafers,
chips, ...) exceed - the producer then fails with:

> The request included a message larger than the max message size the server will accept

The broker is configured for **50 MiB** instead (`KAFKA_MESSAGE_MAX_BYTES` and
friends in the compose file). Keep the value in sync with
[`../Dev`](../Dev/docker-compose-kafka-dev.yml) and `Dev/docker-compose.kafka-local.yml`
at the repo root - a payload that works in Dev must work here too.

Raising it takes a **broker restart**, so treat it as a maintenance window:
in-flight produce/fetch requests fail while the container recreates.

Topics auto-created without an explicit override inherit the broker default, so
they pick up the new limit on restart. To check one - or to fix a topic that
*does* carry an override:

```bash
docker exec svt.kafka-broker--prod kafka-configs --bootstrap-server localhost:9094 --entity-type topics --entity-name svt.db-agent.request.reply --describe
```

```bash
docker exec svt.kafka-broker--prod kafka-configs --bootstrap-server localhost:9094 --entity-type topics --entity-name svt.db-agent.request.reply --alter --add-config max.message.bytes=52428800
```

## Deploy as a systemd service (RHEL)

The unit runs `docker compose` as a `oneshot` service that stays active
(`RemainAfterExit=yes`). Paths in the unit are absolute, so they must match
where the compose file actually lives on the host.

1. **Copy the compose file** to the path referenced by the unit:

   ```bash
   sudo mkdir -p /opt/docker
   sudo cp docker-compose-kafka-prod.yml /opt/docker/
   ```

   > If you deploy to a different directory, update `WorkingDirectory` and the
   > two `-f /opt/docker/...` paths in `svt.kafka--prod.service` to match.

2. **Install the unit** and enable it:

   ```bash
   sudo cp svt.kafka--prod.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now svt.kafka--prod.service
   ```

3. **Check status / logs:**

   ```bash
   sudo systemctl status svt.kafka--prod.service
   sudo journalctl -xeu svt.kafka--prod.service
   ```

## Running Dev and Prod on the same host

The two environments are designed to coexist on one machine. Everything that
could clash is namespaced:

- **Containers / volumes / network:** suffixed `--prod` vs `--dev`.
- **Host ports:** Kafka `9090-9092` (prod) vs `9094-9096` (dev); UI `8088` vs `8087`.
- **KRaft cluster ID:** distinct per environment (a shared ID corrupts metadata).
- **Compose project name:** `-p svt-kafka--prod` vs `-p svt-kafka--dev`. Without
  this both default to the working-dir name (`docker`), and `--remove-orphans`
  from one stack would delete the other's containers.

### Notes

- `WorkingDirectory` must be a **directory** (systemd `chdir`s into it before
  starting). The compose file is selected explicitly via `-f`, so its non-default
  name (`docker-compose-kafka-prod.yml`) is fine.
- Verify the Docker CLI path with `command -v docker`. The unit uses `/bin/docker`
  (on RHEL `/bin` is a symlink to `/usr/bin`); adjust if yours differs.
- After editing the unit, re-run `sudo systemctl daemon-reload`. If it had been
  failing, clear the restart counter with
  `sudo systemctl reset-failed svt.kafka--prod.service`.
