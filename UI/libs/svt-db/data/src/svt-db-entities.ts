import { SvtDbWaferTypeEntity, SvtDbWaferTypeMapEntity } from './wafer-types'


/**
 * Every entity of the SVT database, in the order they are registered with MikroORM. The application
 * passes this list to `SvtDbOrmModule.forRoot`; the CLI discovers the same classes from the sources.
 * Phase 3 appends the remaining entities here.
 */
export const SVT_DB_ENTITIES = [
    SvtDbWaferTypeEntity,
    SvtDbWaferTypeMapEntity,
]
