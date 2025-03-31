import svtconfigdbinteractions as configdb

schemas = ["test", "Prod"]
types = ["enum_engineeringRun", "enum_foundry", "enum_waferTech",
         "enum_waferMapOrientation",
         "enum_asicFamilyType"]

for schema in schemas:
    configdb.createSchema(schema)
    for enum in types:
        configdb.createEnumType(f"{schema}.{enum}")

configdb.commit()

configdb.close()
