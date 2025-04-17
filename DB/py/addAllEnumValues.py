import json

import svtconfigdbinteractions as configdb

schemas = ["test", "Prod"]

# get enum types from DB
db_enum_types = {}
schema_enum = configdb.getAllEnumTypes()
for schema, enum in schema_enum:
    db_enum_types.setdefault(schema, set()).add(enum)

enum_type_json_flname = 'enum_types.json'

with open(enum_type_json_flname, 'r') as file:
    types = json.load(file)

    for schema in schemas:
        l_schema = schema.lower()
        for name in types.keys():
            l_name = name.lower()
            for value in types[name]:
                if (l_schema not in db_enum_types or l_name not in db_enum_types[l_schema]):
                    print(f"Enum {l_name} is not in the schema {l_schema}, creating new enum {l_name}")
                    configdb.createEnumType(f"{l_schema}.{l_name}")
                if value is not None:
                    configdb.addEnumValue(l_schema, l_name, value)

configdb.commit()

enum_values = configdb.getAllEnumValues()
for row in enum_values:
    print(row)

configdb.close()
