import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicAuthController } from './controllers'
import { EpicAuthGuard } from './guards'
import { EpicAuthSvc, loadEpicAuthConfig } from './models'
import {
    EpicAuthLoginThrottleService,
    EpicAuthService,
    EpicAuthSessionService,
    EpicAuthUserCacheService,
    EpicAuthUsersService,
} from './services'


/**
 * The log-in, the session and the global guard (ticket 395). `EpicAuthGuard` is registered as `APP_GUARD`: every
 * HTTP route of the BFF needs a session unless it is marked `@EpicPublic()`. The module exports what the WebSocket
 * gateway and the user management (ticket 396) need.
 */
@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicAuthSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.auth',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.auth',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [
        {
            provide: EpicAuthSvc.CONFIG,
            useFactory: (configService: ConfigService) => loadEpicAuthConfig((name) => configService.get<string>(name)),
            inject: [ConfigService],
        },
        EpicAuthUsersService,
        EpicAuthSessionService,
        EpicAuthUserCacheService,
        EpicAuthLoginThrottleService,
        EpicAuthService,
        {
            provide: APP_GUARD,
            useClass: EpicAuthGuard,
        },
    ],
    controllers: [EpicAuthController],
    exports: [
        EpicAuthSessionService,
        EpicAuthUserCacheService,
        EpicAuthLoginThrottleService,
        EpicAuthUsersService,
    ],
})
export class EpicAuthModule {
}
