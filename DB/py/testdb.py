import svtconfigdbinteractions as configdb

newVersion = configdb.createNewVersion(versionName='TEST', versionDescription="", baseVersion=None)
configdb.commit()

configdb.showPgqlVersion()
versionId = configdb.getMaxVersionId()
print(f"current {versionId} new Version {newVersion}")

configdb.close()
