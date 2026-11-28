import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import {
    EpicUserCreateRequestDto,
    EpicUserDto,
    EpicUserPasswordSetRequestDto,
    EpicUserUpdateRequestDto,
    processKafkaReplyError,
} from 'epic/entities'
import { EpicUserRole } from 'svt-ts-types'

import { EpicRoles } from '../../auth'
import { EpicUsersService } from '../services'


/**
 * The users of the installation, for an Admin only (ticket 396): another role gets `403`, no session `401`. No route
 * returns a password or a hash, and none deletes a user: an Admin switches it off (`isActive: false`). The DB agent
 * keeps one active Admin: a change that would leave none is `400` with its text.
 */
@ApiTags('users')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiForbiddenResponse({ description: 'The user is not an Admin' })
@Controller('/users')
@EpicRoles(EpicUserRole.Admin)
export class EpicUsersController {

    constructor(private readonly usersService: EpicUsersService) {
    }

    @Get()
    @ApiOkResponse({ type: EpicUserDto, isArray: true, description: 'Every user, active or not, in ascending order of id' })
    getAll(): Promise<EpicUserDto[]> {
        return processKafkaReplyError(() => this.usersService.getAll())
    }

    @Post()
    @ApiCreatedResponse({ type: EpicUserDto, description: 'The new user, active' })
    @ApiBadRequestResponse({ description: 'The login exists (in any case) or breaks the login rule; a role or a password not valid' })
    create(@Body() body: EpicUserCreateRequestDto): Promise<EpicUserDto> {
        return processKafkaReplyError(() => this.usersService.create(body))
    }

    @Patch('/:id')
    @ApiOkResponse({ type: EpicUserDto })
    @ApiBadRequestResponse({ description: 'The change would leave no active Admin; a value that is not valid' })
    @ApiNotFoundResponse({ description: 'No user with this id' })
    update(@Param('id', ParseIntPipe) id: number, @Body() body: EpicUserUpdateRequestDto): Promise<EpicUserDto> {
        return processKafkaReplyError(() => this.usersService.update(id, body))
    }

    @Post('/:id/password')
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({ type: EpicUserDto, description: 'The password is set; the current one is not needed' })
    @ApiBadRequestResponse({ description: 'A password that is not 8 to 128 characters long' })
    @ApiNotFoundResponse({ description: 'No user with this id' })
    setPassword(@Param('id', ParseIntPipe) id: number, @Body() body: EpicUserPasswordSetRequestDto): Promise<EpicUserDto> {
        return processKafkaReplyError(() => this.usersService.setPassword(id, body.password))
    }

}
