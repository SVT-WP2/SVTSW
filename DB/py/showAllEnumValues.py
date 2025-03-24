import svtconfigdbinteractions as configdb

schemas = ["test", "Prod"]

enum_foundry = {"enum_foundry": ["TowerJazz"]}
enum_waferTech = {"enum_waferTech": ["TPSCo65"]}
enum_engineeringRun = {"enum_engineeringRun": ["ER1"]}
enum_waferType = {"enum_waferType": ["ER1"]}
enum_familyType = {"enum_familyType": ["babyMOSS",
                                       "MOSS",
                                       "NKF7",
                                       "APTS",
                                       "NKF6",
                                       "NKF5"]}

enum_types_dict = {**enum_foundry, **enum_waferTech,
                   **enum_engineeringRun, **enum_waferType,
                   **enum_familyType}

for schema in schemas:
    for type_name, values in enum_types_dict.items():
        if len(values):
            for value in values:
                configdb.addEnumValue(schema, type_name, value)

configdb.commit()

enum_values = configdb.showAllEnumValues()
for row in enum_values:
    print(row)

configdb.close()
