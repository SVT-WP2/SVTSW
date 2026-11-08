import { SvtDbAsicEntity } from './asics'
import { SvtDbChipEntity } from './chips'
import { SvtDbWaferTypeEntity, SvtDbWaferTypeMapEntity } from './wafer-types'
import { SvtDbWaferEntity, SvtDbWaferLocationEntity } from './wafers'


/**
 * Every entity of the SVT database, in the order they are registered with MikroORM. The application
 * passes this list to `SvtDbOrmModule.forRoot`; the CLI discovers the same classes from the sources.
 * Each slice appends its entities here.
 */
export const SVT_DB_ENTITIES = [
    SvtDbWaferTypeEntity,
    SvtDbWaferTypeMapEntity,
    SvtDbWaferEntity,
    SvtDbWaferLocationEntity,
    SvtDbAsicEntity,
    SvtDbChipEntity,
]
