import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UnauthorizedException } from '@nestjs/common'
import { ApiNoContentResponse, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { EpicAuthLoginRequestDto, EpicAuthUserDto } from 'epic/entities'
import type { Response } from 'express'
import { EpicAuthUser } from 'svt-ts-types'

import { EpicCurrentUser, EpicPublic } from '../decorators'
import { EpicAuthSvc } from '../models'
import { EpicAuthService, EpicAuthSessionService, EpicAuthTooManyAttemptsException } from '../services'


@ApiTags('auth')
@Controller('auth')
export class EpicAuthController {

    constructor(
        private readonly authService: EpicAuthService,
        private readonly session: EpicAuthSessionService,
    ) {
    }

    @Post('login')
    @EpicPublic()
    @HttpCode(HttpStatus.OK)
    @ApiOkResponse({ type: EpicAuthUserDto, description: 'The user; the session cookie is set' })
    @ApiUnauthorizedResponse({ description: EpicAuthSvc.LOGIN_FAILED_MESSAGE })
    @ApiTooManyRequestsResponse({ description: EpicAuthSvc.TOO_MANY_ATTEMPTS_MESSAGE })
    async login(@Body() body: EpicAuthLoginRequestDto, @Res({ passthrough: true }) response: Response): Promise<EpicAuthUserDto> {
        try {
            const { user, token } = await this.authService.login(body)
            this.session.setCookie(response, token)
            return user
        }
        catch (error) {
            if (error instanceof EpicAuthTooManyAttemptsException) {
                response.setHeader('Retry-After', String(error.retryAfterSeconds))
            }
            throw error
        }
    }

    /** Clears the cookie. The token itself stays valid until it expires: the BFF keeps no list of sessions. */
    @Post('logout')
    @EpicPublic()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiNoContentResponse({ description: 'The session cookie is cleared, also when there was none' })
    logout(@Res({ passthrough: true }) response: Response): void {
        this.session.clearCookie(response)
    }

    @Get('me')
    @ApiOkResponse({ type: EpicAuthUserDto })
    @ApiUnauthorizedResponse({ description: 'No valid session' })
    me(@EpicCurrentUser() user: EpicAuthUser | undefined): EpicAuthUserDto {
        if (!user) {
            // The guard sets the user on every route that is not public; this is only a second line.
            throw new UnauthorizedException()
        }
        return user
    }

}
