import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsString } from 'class-validator'
import { EpicSvtTestTemplate } from 'svt-ts-types'


export class EpicSvtTestTemplateDto implements EpicSvtTestTemplate {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string' })
    dutType: string

    @IsBoolean()
    @ApiProperty({ type: 'boolean' })
    isEnabled: boolean

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfigId: number

}

