import svtconfigdbinteractions as configdb

schemas = ["test", "Prod"]

for schema in schemas:
    configdb.createSchema(schema)

configdb.commit()

configdb.close()
