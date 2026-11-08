import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicSvtTestSetup } from 'svt-ts-types'


export class EpicSvtTestSetupDto implements EpicSvtTestSetup {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsOptional()
    @IsNumber()
    @ApiProperty({ type: 'number', nullable: true, description: 'null when the setup has no default config' })
    defaultConfigId: number | null

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value generalLocation' })
    generalLocation: string

}
