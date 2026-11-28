import { ApiProperty } from '@nestjs/swagger'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'


/** The logged-in user, as `POST /api/auth/login` and `GET /api/auth/me` answer it. No hash, no `isActive`. */
export class EpicAuthUserDto implements EpicAuthUser {

    @ApiProperty({ type: 'number' })
    id: number

    @ApiProperty({ type: 'string' })
    login: string

    @ApiProperty({ type: 'string' })
    name: string

    @ApiProperty({ enum: EpicUserRole })
    role: EpicUserRole

}
