#! /usr/bin/env bash
(
  set -euo pipefail

  db_name="svt_sw_db_test"

  _psql_exec() {
    eval " psql -h dbod-svt-sw-pgdb.cern.ch -U admin -p 6600 ${*:+$*}"
  }

  _chTZ() {
    read -rp "Enter new TimeZone: " TZ
    pgql_cmd="ALTER DATABASE ${db_name} SET TIMEZONE TO '${TZ}';"
    _psql_exec -c \""${pgql_cmd}"\"
  }

  _chpass() {
    read -rp "Enter new pass: " PASS
    pgql_cmd="ALTER USER admin PASSWORD '${PASS}';"
    _psql_exec -c \""${pgql_cmd}"\"
  }

  _createdb() {
    local DB_NAME=${1:-}
    [ -z "$DB_NAME" ] && {
      echo "ERROR: no DB name provided."
      exit 1
    }
    local cmd="SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';"
    if [[ "$(_psql_exec -XtAc \""$cmd"\")" == "1" ]]; then
      echo "DB ${DB_NAME} exits, exiting."
      exit 1
    else
      cmd="CREATE DATABASE ${DB_NAME};"
      _psql_exec -c \""${cmd}"\"
    fi
  }

  _run() {
    in_file=${1:-}
    [ -z "$in_file" ] && {
      echo "ERROR: script file not provided."
      exit 1
    }
    [[ -f "$in_file" ]] || {
      echo "ERROR script $in_file not found."
      exit 1
    }
    _psql_exec "-d ${db_name} -a -f ${in_file} "
  }

  [ $# -eq 0 ] && {
    echo "ERROR at least a argumentis needed"
    exit 1
  }

  action=${1:-}

  case $action in
  --chTZ)
    _chTZ
    ;;
  --chpass)
    _chpass
    ;;
  --createdb)
    shift
    _createdb "$@"
    ;;
  --run)
    shift
    _run "$@"
    ;;
  --run2all)
    shift
    for schema in prod test; do
      echo
      echo "Running to $schema"
      echo
      sed "s/%SCHEMA_NAME%/$schema/g" "${1:-}" >temp.sql
      _run temp.sql
      rm temp.sql

    done
    ;;
  --open)
    _psql_exec "-d ${db_name}"
    ;;
  *)
    exit 1
    ;;
  esac
)
