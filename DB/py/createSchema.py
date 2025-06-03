import svtconfigdbinteractions as configdb

schemas = ["Prod"]

for schema in schemas:
    configdb.createSchema(schema)

configdb.commit()

configdb.close()
