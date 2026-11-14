import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator'
import { EpicEquipmentCreateRequest, EpicEquipmentLocationHistoryRecord } from 'svt-ts-types'


/**
 * `CreateEquipment` payload. The Kafka contract (`EquipmentCreateDto`) and the C++ agent accept a `null`
 * `specification`; the `epic/entities` DTO requires a string, so the request is validated with this one.
 */
export class SvtDbAgentNextEquipmentCreateDto implements EpicEquipmentCreateRequest {

    @IsString()
    name!: string

    @IsInt()
    equipmentTypeId!: number

    @IsString()
    generalLocation!: string

    @IsOptional()
    @IsString()
    specification!: string | null

}

/**
 * `UpdateEquipmentLocation` payload: the history record itself. As for wafers, the contract DTO in
 * `epic/entities` is a reply shape without validators on `note` and `username`, so the request is validated
 * with this one: `date` and `username` may be `null` or absent (the database stamps the day), `note` may be
 * absent.
 */
export class SvtDbAgentNextEquipmentLocationRecordDto implements EpicEquipmentLocationHistoryRecord {

    @IsInt()
    equipmentId!: number

    @IsString()
    generalLocation!: string

    @IsOptional()
    @IsDateString({ strict: true })
    date!: string | null

    @IsOptional()
    @IsString()
    note!: string

    @IsOptional()
    @IsString()
    username!: string | null

}
