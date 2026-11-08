import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator'
import { EpicChipLocationHistoryRecordEntity } from 'epic/entities'


/**
 * `UpdateChipLocation` payload: the history record itself. As for wafers, the contract DTO in `epic/entities`
 * is a reply shape without validators on `note` and `username`, so the request is validated with this one:
 * `date` and `username` may be `null` or absent (the database stamps the day), `note` may be absent.
 */
export class SvtDbAgentNextChipLocationRecordDto implements EpicChipLocationHistoryRecordEntity {

    @IsInt()
    chipId!: number

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
