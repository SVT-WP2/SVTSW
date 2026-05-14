import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicWafersController, EpicWaferTypesController } from './controllers'
import { EpicWafersSvc } from './models'
import { EpicWafersService, EpicWaferTypesService } from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicWafersSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.wafers',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.wafers',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicWafersService, EpicWaferTypesService],
    controllers: [EpicWafersController, EpicWaferTypesController],
})
export class EpicWafersModule {
}
