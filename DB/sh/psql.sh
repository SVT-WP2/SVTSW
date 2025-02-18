#! /usr/bin/env bash
(
  set -euo pipefail

  _cmd_psql() {
    local cmd
    cmd=${1:-}
    [[ -z "$cmd" ]] && {
      echo "ERROR missing command."
      exit 1
    }
    PGPASSWORD='svt-mosaix' psql -h dbod-svt-sw-pgdb.cern.ch -U admin -p 6600 -c "$cmd"
  }

  _run_sql_script() {
    local in_file
    in_file=${1:-}
    [[ -f "$in_file" ]] || {
      echo "ERROR script $in_file not found."
      exit 1
    }
    PGPASSWORD='svt-mosaix' psql -h dbod-svt-sw-pgdb.cern.ch -U admin -p 6600 -d svt_sw_db_test -a -f "$in_file"
  }

  _chpass() {
    read -rp "Enter new pass: " PASS
    pgql_cmd="ALTER USER admin PASSWORD '${PASS}';"
    _cmd_psql "${pgql_cmd}"
  }

  _createdb() {
    local DB_NAME=${1:-}
    [ -z "$DB_NAME" ] && {
      echo "ERROR: no DB name provided."
      exit 1
    }
    if [[ "$(_cmd_psql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';")" = '1' ]]; then
      echo "DB ${DB_NAME} exits, exiting."
      exit 1
    else
      _cmd_psql "CREATE DATABASE ${DB_NAME};"
    fi
    pgql_cmd="CREATE DATABASE"
  }

  _createTable() {
    local sql_in_fl=${1:-}
    [ -z "$sql_in_fl" ] && {
      echo "ERROR: no sql input file entered."
      exit 1
    }
    _run_sql_script "$sql_in_fl"
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
  --createTable)
    shift
    _createTable "$@"
    ;;
  *)
    exit 1
    ;;
  esac
)
