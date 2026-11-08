import { OptionalProps } from '@mikro-orm/core'
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'


/**
 * `main."SvtTestType"`: a kind of test (`Impedance Test`, `StepRamp`, …). The DUT types it applies to are
 * `SvtTestTypeDUTTypeList`, its configurations `SvtTestTypeConfig`.
 */
@Entity({ tableName: 'SvtTestType' })
export class SvtDbSvtTestTypeEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 100, unique: true })
    name!: string;

    [OptionalProps]?: 'id'

}
