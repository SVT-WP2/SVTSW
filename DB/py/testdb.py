import svtconfigdbinteractions as configdb

newVersion = configdb.createNewVersion(versionId=None, versionName='TEST', versionDescription=None, baseVersion=None)
versionId = configdb.getMaxVersionId()
print(f"current {versionId} new Version {newVersion}")
configdb.commit()
configdb.close()
