import svtconfigdbinteractions as configdb

schemas = ["test", "Prod"]

types = [
    {"enum_engineeringRun": ["ER1", "ER2", "ER3", "LAS1", "Ancillary1"]},
    {"enum_foundry": ["TowerSemiconductor", "Xfab"]},
    {"enum_waferTech": ["TPSCo65", "Xfab110"]},
    {
        "enum_asicFamilyType": [
            "MOSS",
            "BabyMOSS",
            "NKF7",
            "MOSAIX",
            "BabyMOSAIX",
            "LAS",
            "Ancillary",
        ]
    },
    {"enum_waferMapOrientation": ["North", "South", "East", "West"]},
    {
        "wpConnectionType": [
            "TCPIP",
            "GPIB",
            "RS232",
            "USB",
            "Ethernet",
            "Modbus",
            "LAN",
        ]
    },
    {"wpGeneralLocation"["CERN_186_R_E10", "Prague", "LosAlamos", "BNL", "RAL"]},
    {"wpSwType": ["Sentio", "VeloxCascade"]},
    {"wpVendor": ["MPI", "CascadeMicrotech", "FormFactor"]},
    {"pcVendor": ["MPI", "Korea", "Synergie", "FormFactorPC"]},
    {"pcName": ["NKF7_MPI", "BabyMOSS_Korea", "Mosaix_Korea"]},
    {"pcModel": ["NKF7", "MosaixLeft", "MosaixRight", "LAS", "BabyMOSS", "Ancillary"]},
    {"pcLocation": ["CERN", "Prague", "LosAlamos", "BNL", "RAL"]},
    {"pcType": ["Vertical", "Cantilever"]},
    {"contctMechanicalQuality": ["Good", "Bad", "AvoidIfPossible"]},
    {"waferInMachineStatus": ["Loaded", "Unloaded"]},
]

for schema in schemas:
    for type_name, values in types.items():
        if len(values):
            for value in values:
                print(f"{schema}, {type_name}, {value}")
                # configdb.addEnumValue(schema, type_name, value)

# configdb.commit()
#
# enum_values = configdb.showAllEnumValues()
# for row in enum_values:
#     print(row)

configdb.close()
