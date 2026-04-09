# SVTTestDatabase
Dummy python script to access SVT test DB.

## Install python requirements
pip install -r requirements.txt

## run test
python py/test.py


# Docker Usage:

```
docker compose run --rm `
  -e SVT_DB_AGENT_DB_HOST=dbod-svt-sw-pgdb.cern.ch `
  -e SVT_DB_AGENT_DB_PORT=6600 `
  -e SVT_DB_AGENT_DB_USER=admin `
  -e SVT_DB_AGENT_DB_PASS= `
  -e SVT_DB_AGENT_DB_NAME=svt_sw_db `
  -e SVT_DB_AGENT_DB_SCHEMA=main `
  -e SVT_DB_AGENT_KAFKA_SERVER=localhost `
  -e SVT_DB_AGENT_KAFKA_PORT=9092 `
  svt-db-agent-dev
```
