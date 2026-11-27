import { Type } from 'class-transformer'
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import {
    EpicChipCreateManyRequest,
    EpicChipCreateManyRequestItem,
    EpicChipCreateRequest,
} from 'svt-ts-types'
import { SvtDbAgentKafkaChips } from 'svt-ts-types/kafka'


/** `data.create` of `CreateChip`. */
export class SvtDbAgentNextChipCreateDto implements EpicChipCreateRequest {

    @IsString()
    serialNumber!: string

    @IsNumber()
    asicId!: number

    /** Enum value `generalLocation`. */
    @IsString()
    generalLocation!: string

}

/** One chip of the `CreateManyChips` payload. */
export class SvtDbAgentNextChipCreateManyItemDto implements EpicChipCreateManyRequestItem {

    @IsString()
    serialNumber!: string

    @IsNumber()
    asicId!: number

}

/** `data.create` of `CreateManyChips`. */
export class SvtDbAgentNextChipCreateManyDto implements EpicChipCreateManyRequest {

    /** Enum value `generalLocation`. */
    @IsString()
    generalLocation!: string

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SvtDbAgentNextChipCreateManyItemDto)
    items!: SvtDbAgentNextChipCreateManyItemDto[]

}

/**
 * `UpdateChipLocation` payload: the move. The contract DTO in `epic/entities` is a reply shape without validators
 * on `note` and `username`, so the request is validated with this one: `date` and `username` may be `null` or
 * absent (the database stamps the day), `note` may be absent. The `userId` and `userName` of a history record are
 * reply fields: the agent takes the user from the header `svt_userId`, and an unknown key is refused.
 */
export class SvtDbAgentNextChipLocationRecordDto implements SvtDbAgentKafkaChips.UpdateChipLocationMessageData {

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
