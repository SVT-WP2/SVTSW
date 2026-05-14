import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'

import { EpicDateString } from '../../common'
import { EpicWaferUpdateEntity } from '../models'


export class EpicWaferUpdateRequestDto implements EpicWaferUpdateEntity {

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

