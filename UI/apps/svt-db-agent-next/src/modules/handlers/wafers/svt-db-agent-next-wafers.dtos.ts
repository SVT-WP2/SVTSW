import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator'
import { EpicWaferLocationHistoryRecord } from 'epic-api-types'


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
