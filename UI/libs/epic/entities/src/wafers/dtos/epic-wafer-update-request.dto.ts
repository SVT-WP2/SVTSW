import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'
import { EpicDateString, EpicWaferUpdateRequest } from 'epic-api-types'


export class EpicWaferUpdateRequestDto implements EpicWaferUpdateRequest {

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsOptional()
    @IsDateString({ strict: true })
    thinningDate: EpicDateString | null

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsOptional()
    @IsDateString({ strict: true })
    dicingDate: EpicDateString | null

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsOptional()
    @IsDateString({ strict: true })
    productionDate: EpicDateString | null

}

