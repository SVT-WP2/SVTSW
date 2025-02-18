import psycopg2
from psycopg2 import OperationalError

db_params = {
        'user' : 'admin',
        'password' : 'svt-mosaix',
        'host' : 'dbod-svt-sw-pgdb.cern.ch',
        'port' : 6600,
        'dbname' : 'svt_sw_db_test',
        }

try:
    conn = psycopg2.connect(**db_params)

except OperationalError as e:
    print(f"Error connecting to database: {e}")

except Exception as e:
     print(f"An unexpected error occurred: {e}")

def commit():
    conn.commit()

def close(cursor=None):
    if cursor is not None:
        cursor.close()

    conn.close()
    print("Database connection closed.")

def showPgqlVersion():
    with conn.cursor() as cur:
        cur.execute("SELECT version();")
        record = cur.fetchone()
        print("Database version:", record)

        cur.close()

def createNewVersion(versionName=None, versionDescription=None, baseVersion=None):
    with conn.cursor() as cur:
        # get a new version ID
        cur.execute("SELECT COUNT(*) FROM test.version")
        newVersionId = cur.fetchone()[0] + 1

        if baseVersion is None:
            baseVersion = newVersionId

        cur.execute("""
            INSERT INTO test.Version (id, name, baseVersion, description)
            VALUES(%(newVersionId)s, %(name)s, %(baseVersion)s, %(description)s)
            """,
            {'newVersionId':newVersionId, 'name':versionName, 'baseVersion':baseVersion, 'description':versionDescription})

        cur.close()

        return newVersionId

def getMaxVersionId():
    with conn.cursor() as cur:
        try:
            cur.execute("""
            SELECT MAX(ID) FROM test.VERSION
            """)
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

        dbId = cur.fetchone()[0]

        cur.close

    return dbId
