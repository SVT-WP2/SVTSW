# Dev Environment

Docker Compose stacks for the SVTSW **development** environment.

| File | Purpose |
| ---- | ------- |
| [`docker-compose-kafka-dev.yml`](docker-compose-kafka-dev.yml) | Kafka broker (KRaft) + Kafka UI |
| [`svt.kafka--dev.service`](svt.kafka--dev.service) | systemd unit that runs the Kafka stack |

## Run with Docker Compose

```bash
docker compose -p svt-kafka--dev -f docker-compose-kafka-dev.yml up -d
docker compose -p svt-kafka--dev -f docker-compose-kafka-dev.yml ps
docker compose -p svt-kafka--dev -f docker-compose-kafka-dev.yml down
```

Kafka UI is then available on port **8087**.

## Large Kafka messages

Kafka caps a single message at **1 MB** by default, which list replies (wafers,
chips, ...) exceed - the producer then fails with:

> The request included a message larger than the max message size the server will accept

The broker is configured for **50 MiB** instead (`KAFKA_MESSAGE_MAX_BYTES` and
friends in the compose file). Keep the value in sync with
[`../Prod`](../Prod/docker-compose-kafka-prod.yml) and `Dev/docker-compose.kafka-local.yml`
at the repo root - a payload that works locally must work here too.

Topics auto-created without an explicit override inherit the broker default, so
they pick up the new limit on restart. To check one - or to fix a topic that
*does* carry an override:

```bash
docker exec svt.kafka-broker--dev kafka-configs --bootstrap-server localhost:9094 --entity-type topics --entity-name svt.db-agent.request.reply --describe
```

```bash
docker exec svt.kafka-broker--dev kafka-configs --bootstrap-server localhost:9094 --entity-type topics --entity-name svt.db-agent.request.reply --alter --add-config max.message.bytes=52428800
```

## Deploy as a systemd service (RHEL)

The unit runs `docker compose` as a `oneshot` service that stays active
(`RemainAfterExit=yes`). Paths in the unit are absolute, so they must match
where the compose file actually lives on the host.

1. **Copy the compose file** to the path referenced by the unit:

   ```bash
   sudo mkdir -p /opt/docker
   sudo cp docker-compose-kafka-dev.yml /opt/docker/
   ```

   > If you deploy to a different directory, update `WorkingDirectory` and the
   > two `-f /opt/docker/...` paths in `svt.kafka--dev.service` to match.

2. **Install the unit** and enable it:

   ```bash
   sudo cp svt.kafka--dev.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now svt.kafka--dev.service
   ```

3. **Check status / logs:**

   ```bash
   sudo systemctl status svt.kafka--dev.service
   sudo journalctl -xeu svt.kafka--dev.service
   ```

### Notes

- `WorkingDirectory` must be a **directory** (systemd `chdir`s into it before
  starting). The compose file is selected explicitly via `-f`, so its non-default
  name (`docker-compose-kafka-dev.yml`) is fine.
- `-p svt-kafka--dev` pins the Compose **project name**. Without it the project
  defaults to the working-dir name (`docker`), which Prod would share — and
  `--remove-orphans` from one stack would then delete the other's containers. See
  [`../Prod/README.md`](../Prod/README.md) for the full same-host coexistence notes.
- Verify the Docker CLI path with `command -v docker`. The unit uses `/bin/docker`
  (on RHEL `/bin` is a symlink to `/usr/bin`); adjust if yours differs.
- After editing the unit, re-run `sudo systemctl daemon-reload`. If it had been
  failing, clear the restart counter with
  `sudo systemctl reset-failed svt.kafka--dev.service`.
