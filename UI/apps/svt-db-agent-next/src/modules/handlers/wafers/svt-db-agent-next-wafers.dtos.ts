import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicDateString, EpicWaferCreateRequest, EpicWaferLocationHistoryRecord, EpicWaferUpdateRequest } from 'epic-api-types'


/** `data.create` of `CreateWafer`. */
export class SvtDbAgentNextWaferCreateDto implements EpicWaferCreateRequest {

    @IsString()
    serialNumber!: string

    @IsNumber()
    batchNumber!: number

    @IsOptional()
    @IsDateString({ strict: true })
    thinningDate!: EpicDateString

    @IsOptional()
    @IsDateString({ strict: true })
    dicingDate!: EpicDateString

    @IsOptional()
    @IsDateString({ strict: true })
    productionDate!: EpicDateString

    @IsNumber()
    waferTypeId!: number

    @IsOptional()
    @IsString()
    generalLocation!: string | null

}

/** `data.update` of `UpdateWafer`. */
export class SvtDbAgentNextWaferUpdateDto implements EpicWaferUpdateRequest {

    @IsOptional()
    @IsDateString({ strict: true })
    thinningDate!: EpicDateString | null

    @IsOptional()
    @IsDateString({ strict: true })
    dicingDate!: EpicDateString | null

    @IsOptional()
    @IsDateString({ strict: true })
    productionDate!: EpicDateString | null

}

/**
 * `UpdateWaferLocation` payload: the history record itself. The contract DTO in `epic/entities` is a reply
 * shape without validators on `note` and `username`, so the request is validated with this one:
 * `date` and `username` may be `null` or absent (the database stamps the day), `note` may be absent.
 */
export class SvtDbAgentNextWaferLocationRecordDto implements EpicWaferLocationHistoryRecord {

    @IsInt()
    waferId!: number

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
