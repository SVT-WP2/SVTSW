import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'
import { EpicWpProbeCard } from 'epic-api-types'


export class EpicWpProbeCardDto implements EpicWpProbeCard {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value pcVendor' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value pcVendor' })
    vendor: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value pcModel' })
    model: string

    @IsDateString({ strict: true })
    @ApiProperty({ type: 'string' })
    arriveDate: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value pcLocation' })
    location: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value pcType' })
    type: string

    @IsNumber()
    @ApiProperty({ type: 'number', nullable: true })
    vendorCleaningInterval: number

}
