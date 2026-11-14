import { OptionalProps } from '@mikro-orm/core'
import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'


/**
 * `main."SvtTestSetup"`: a test bench. Its default configuration is the `SvtTestSetupDefaultConfig` row,
 * its configurations are `SvtTestSetupConfig`. Both columns are nullable in the database although the
 * contract requires them.
 */
@Entity({ tableName: 'SvtTestSetup' })
export class SvtDbSvtTestSetupEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 100, nullable: true })
    name!: string | null

    @Enum({ nativeEnumName: 'wpGeneralLocation', items: SVT_DB_ENUM_VALUES.wpGeneralLocation, nullable: true })
    generalLocation!: string | null;

    [OptionalProps]?: 'id' | 'name' | 'generalLocation'

}
