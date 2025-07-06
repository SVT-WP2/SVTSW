> [!Note]
>  note: use --local option to load MacOS configuration
# Useful DB commands

```bash
# Open db
./psql [--local] --open

# - Update wafermap for wafertype
./psql.sh [—local] --exec "UPDATE test.wafertype SET wafermap = '\''$(cat ../../Configurations/WaferTypeMappings/ER1WaferMap_v0.json)'\'' WHERE id = 1;"

# restart sequence value
./psql.sh --local --exec "ALTER SEQUENCE test.wafer_id_seq RESTART [WITH 0]"
# get last sequence value
./psql.sh --local --exec "SELECT last_value FROM test.wafer_id_seq;"
```

