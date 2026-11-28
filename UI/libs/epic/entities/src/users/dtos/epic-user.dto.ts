import { ApiProperty } from '@nestjs/swagger'
import { EpicDateTimeString, EpicUser, EpicUserRole } from 'svt-ts-types'


/** A user, as the user management routes answer it. It never holds the password hash. */
export class EpicUserDto implements EpicUser {

    @ApiProperty({ type: 'number' })
    id: number

    @ApiProperty({ type: 'string', description: 'In lower case' })
    login: string

    @ApiProperty({ type: 'string' })
    name: string

    @ApiProperty({ enum: EpicUserRole })
    role: EpicUserRole

    @ApiProperty({ type: 'boolean', description: 'false: the user cannot log in' })
    isActive: boolean

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt: EpicDateTimeString

}
