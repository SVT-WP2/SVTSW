import { OptionalProps } from '@mikro-orm/core'
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'


/** `main."EquipmentType"`: a kind of lab equipment (`Oscilloscope`, `Multimeter`, …), by unique name. */
@Entity({ tableName: 'EquipmentType' })
export class SvtDbEquipmentTypeEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 50, unique: true })
    name!: string;

    [OptionalProps]?: 'id'

}
