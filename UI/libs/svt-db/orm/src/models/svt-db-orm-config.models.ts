/** Injection token of the {@link SvtDbOrmConfig} the application provides to `SvtDbOrmModule.forRoot`. */
export const SVT_DB_ORM_CONFIG = 'SVT_DB_ORM_CONFIG'

/** PostgreSQL connection of the SVT database; the shape `svt-db-agent-next` derives from `SVT_DB_AGENT_DB_*`. */
export type SvtDbOrmConfig = {
    host: string
    port: number
    user: string
    password: string
    dbName: string
    /** Schema holding every table; `main` in every environment. */
    schema: string
    /** Log every SQL statement (MikroORM `debug`). */
    debug: boolean
}
