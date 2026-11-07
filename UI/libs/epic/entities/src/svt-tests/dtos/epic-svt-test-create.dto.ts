import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicSvtDutEntityName, EpicSvtTestCreateRequest } from 'epic-api-types'


export class EpicSvtTestCreateDto implements EpicSvtTestCreateRequest {

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value dutEntityName' })
    dutEntityName: EpicSvtDutEntityName

    @IsNumber()
    @ApiProperty({ type: 'number' })
    dutId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfigId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testSetupConfigId: number

}

