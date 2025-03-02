#! /usr/bin/env bash
(
  set -euo pipefail

  _psql_exec_no_db() {
     psql -h dbod-svt-sw-pgdb.cern.ch -U admin -p 6600 ${@:+$*}
  }

  _psql_exec_in_db() {
     psql -h dbod-svt-sw-pgdb.cern.ch -U admin -p 6600 -d svt_sw_db_test ${@:+$*}
  }

  _chpass() {
    read -rp "Enter new pass: " PASS
    pgql_cmd="ALTER USER admin PASSWORD '${PASS}';"
    _psql_exec_no_db -c "${pgql_cmd}"
  }

  _createdb() {
    local DB_NAME=${1:-}
    [ -z "$DB_NAME" ] && {
      echo "ERROR: no DB name provided."
      exit 1
    }
    local cmd="SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';"
    if [[ "$(_psql_exec_no_db -XAtc "$cmd")" == "1" ]]; then
      echo "DB ${DB_NAME} exits, exiting."
      exit 1
    else
      cmd="CREATE DATABASE ${DB_NAME};"
    #   _psql_exec_no_db -c "${cmd}"
    fi
  }

  [ $# -eq 0 ] && {
    echo "ERROR at least a argumentis needed"
    exit 1
  }

  action=${1:-}

  case $action in
  --chpass)
    _chpass
    ;;
  --createdb)
    shift
    _createdb "$@"
    ;;
  --run)
    shift
    in_file=${1:-}
    [ -z "$in_file" ] && {
      echo "ERROR: script file not provided."
      exit 1
    }
    [[ -f "$in_file" ]] || {
      echo "ERROR script $in_file not found."
      exit 1
    }
    _psql_exec_in_db "-a -f $in_file"
    ;;
  --open)
    _psql_exec_in_db
    ;;
  *)
    exit 1
    ;;
  esac
)
