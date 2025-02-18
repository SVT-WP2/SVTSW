#!/usr/bin/env bash
PGPASSWORD='svt-mosaix' psql -h dbod-svt-sw-pgdb.cern.ch -U admin -p 6600 -d svt_sw_db_test
