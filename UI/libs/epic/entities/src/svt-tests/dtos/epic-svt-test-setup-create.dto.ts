import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { EpicSvtTestSetupCreateEntity } from '../models'


export class EpicSvtTestSetupDefaultConfigCreateDto {

    @IsString()
    @ApiProperty({ type: 'string' })
    name!: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'JSON string' })
    configBody!: string

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    note: string

}

export class EpicSvtTestSetupCreateDto implements EpicSvtTestSetupCreateEntity {

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value generalLocation' })
    generalLocation: string

    @ApiProperty({ type: EpicSvtTestSetupDefaultConfigCreateDto })
    @ValidateNested()
    @Type(() => EpicSvtTestSetupDefaultConfigCreateDto)
    defaultConfig!: EpicSvtTestSetupDefaultConfigCreateDto


}


