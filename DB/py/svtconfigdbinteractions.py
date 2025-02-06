import mysql.connector
from mysql.connector import errorcode

config = {
        'user' : 'admin',
        'passwd' : 'svt-mosaix',
        'host' : 'dbod-svt-mosaix-db.cern.ch',
        'port' : 5524,
        'database' : 'svt_mosaix_test',
        'raise_on_warnings': True
        }

try:
    cnx = mysql.connector.connect(**config)

except mysql.connector.Error as err:
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print("Something is wrong with your user name or password")
    elif err.errno == errorcode.ER_BAD_DB_ERROR:
        print("Database does not exist")
    else:
        print(err)

def commit():
    cnx.commit()

def close(cursor=None):
    cnx.close()

def createNewVersion(versionId=None, versionName=None, versionDescription=None, baseVersion=None):
    with cnx.cursor() as cur:
        if versionId is None:
            # get a new version ID
            cur.execute("SELECT MAX(ID) FROM TEST_VERSION")
            newVersionId = cur.fetchone()[0] + 1
            # add a new version to seq
        else:
            newVersionId = versionId

        if baseVersion is None:
            baseVersion = newVersionId

        cur.execute("""
            INSERT INTO TEST_VERSION(ID, BASE_VERSION, NAME, DESCRIPTION)
            VALUES(%(newVersionId)s, %(baseVersion)s, %(name)s, %(description)s)
            """, {'newVersionId':newVersionId, 'baseVersion':baseVersion, 'name':versionName, 'description':versionDescription})

        cur.close()

    return newVersionId

def getMaxVersionId():
    with cnx.cursor() as cur:
        cur.execute("""
        SELECT MAX(ID) FROM TEST_VERSION
        """)

        try:
            dbId = cur.fetchone()[0]
        except:
            dbId = None
        cur.close
    return dbId
