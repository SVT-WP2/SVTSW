import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicEnumsController } from './controllers'
import { EpicEnumsSvc } from './models'
import { EpicEnumsService } from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicEnumsSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.eunms',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.eunms',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicEnumsService],
    controllers: [EpicEnumsController],
})
export class EpicEnumsModule {
}
