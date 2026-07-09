import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicSvtDutEntityName, EpicSvtTestResolvedEntity, EpicSvtTestResultStatus, EpicSvtTestStatus } from '../models'


export class EpicSvtTestDto implements EpicSvtTestResolvedEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value dutEntityName' })
    dutEntityName: EpicSvtDutEntityName

    @IsNumber()
    @ApiProperty({ type: 'number' })
    dutId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfig: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testSetupConfigId: number

    @IsString()
    @ApiProperty({ type: 'string' })
    createdAt: string

    @IsString()
    @ApiProperty({ type: 'string' })
    startedAt: string

    @IsString()
    @ApiProperty({ type: 'string' })
    finishedAt: string

    @IsString()
    @ApiProperty({ type: 'string' })
    pathToResult: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value testResultStatus (physical, stored in the DB)' })
    testResultStatus: EpicSvtTestResultStatus

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value status (synthetic, derived on the BE from testResultStatus)' })
    status: EpicSvtTestStatus

}
