# TestAgent

Kafka-based test agent framework with Dockerized Kafka/ZooKeeper and pluggable test command handlers.

---

## Quick Start

1. Clone the repository

```bash
git clone <repo-url>
cd SVT-TestAgent
```

2. Create & activate a virtual environment (Python 3.9+ recommended)
```bash
python3 -m venv SVTvenv
# macOS / Linux
source SVTvenv/bin/activate
# Windows PowerShell
# .\SVTvenv\Scripts\Activate.ps1
```

3. Install in editable mode

```bash
pip install -e .
```

This exposes CLI commands inside the venv:
- start-broker       — Start the Kafka broker (Docker)
- stop-broker        — Stop the Kafka broker and cleanup volumes
- dummyDB-start      — Start the dummy database
- dummyDB-stop       — Stop the dummy database
- testagent          — Start the test agent (broker mode)
- send-dummy-message — Send a JSON request to svt.test-agent.request

---

## Run with Dockerized Kafka (Broker mode)

Start broker (choose a port):
```bash
#choose port, eg: 9094
KAFKA_LOCAL_PORT=9094 start-broker
```
Notes:
- Starts ZooKeeper, Kafka and Kafka-UI in Docker
- Auto-creates topics:
	- svt.test-agent.request
	- svt.test-agent.request.reply
	- svt.db-agent.request
	- svt.db-agent.request.reply
- Saves chosen port to `kafka_port.json` for reuse

Stop broker:
```bash
stop-broker
```

Kafka UI: http://localhost:8088

---

## Sending the dummy database

Start dummy database:
```bash
dummyDB-start
```

Stop dummy database:
```bash
dummyDB-stop
```


## Sending a Test Message

Create `test_message.json`:
```json
{
	"command": "RunTest",
	"testId": "001",
	"data": {
		"params": {
			"chipName": "SLDO"
		}
	}
}
```

Send it:
```bash
send-dummy-message test_message.json
```

Or specify a config file explicitly:
```bash
send-dummy-message config.py test_message.json
```

---

## Commands Recap

- start-broker: 		Start Kafka broker & Kafka-UI in Docker  
- stop-broker: 			Stop broker and cleanup Docker volumes 
- dummyDB-start:		Start the dummy database
- dummyDB-stop: 		Stop the dummy database
- testagent: 			run-testAgent: Run agent in broker mode  
- send-dummy-message: 	Send JSON request to svt.test-agent.request

---

## Requirements

- Python 3.8+ (3.9+ recommended)
- Docker & Docker Compose (for broker mode)
- Virtual environment (venv) recommended

---

## Troubleshooting

- No `kafka_port.json`: run `start-broker` once to create it.  
- Port conflict: choose another port, e.g.:
	```bash
	KAFKA_LOCAL_PORT=9096 start-broker
	```
- Imports not found: activate venv and ensure `pip install -e .` has been run.  

---

