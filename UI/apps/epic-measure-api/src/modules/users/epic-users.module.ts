import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicAuthModule } from '../auth'

import { EpicUsersController } from './controllers'
import { EpicUsersSvc } from './models'
import { EpicUsersService } from './services'


/**
 * The user management of an Admin (ticket 396). It imports `EpicAuthModule` for the cache of the guard, which it
 * clears for a user after a change of that user.
 */
@Module({
    imports: [
        EpicAuthModule,
        ClientsModule.registerAsync([
            {
                name: EpicUsersSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.users',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.users',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicUsersService],
    controllers: [EpicUsersController],
})
export class EpicUsersModule {
}
