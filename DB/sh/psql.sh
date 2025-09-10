#! /usr/bin/env bash
(
  set -euo pipefail

  db_name='svt_sw_db_test'
  db_schema='main'
  PSQL_CMD='psql'
  HOST='dbod-svt-sw-pgdb'

  _psql_exec() {
    eval " PGOPTIONS=\"--search_path=$db_schema\" $PSQL_CMD -h $HOST -U admin -p 6600 ${*:+$*}"
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

  _exec() {
    local opt=${1:-}
    local cmd=${2:-}
    db_names=${db_names:-$db_name}
    for db in "${db_names[@]}"; do
      echo -e "Executing cmd '$cmd' in db $db"
      _psql_exec "-d $db $opt '$cmd'"
    done
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

    _exec '-a -f' "${in_file}"
  }

  [ $# -eq 0 ] && {
    echo "ERROR at least a argumentis needed"
    exit 1
  }

  while [ $# -gt 0 ]; do
    action=${1:-}

    case $action in
    --local)
      PSQL_CMD='psql-17'
      HOST='localhost'
      ;;
    --db)
      shift
      db_name="${1:-}"
      ;;
    --schema)
      shift
      db_schema=${1:-}
      ;;
    --all)
      db_names=('svt_sw_db_test' 'svt_sw_db')
      ;;
    --chTZ)
      _chTZ
      ;;
    --chpass)
      _chpass
      ;;
    --createdb)
      shift
      _createdb "$1"
      ;;
    --exec)
      shift
      _exec '-c' "${1:-}"
      ;;
    --run)
      shift
      _run "${1:-}"
      ;;
    --open)
      _psql_exec "-d ${db_name}"
      ;;
    *)
      echo "unknow action $action"
      exit 1
      ;;
    esac
    shift
  done
)
