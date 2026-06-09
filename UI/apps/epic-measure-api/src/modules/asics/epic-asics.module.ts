import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicAsicsController } from './controllers'
import { EpicAsicsService } from './epic-asics.service'
import { EpicAsicsSvc } from './models'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicAsicsSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.asics',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.asics',
                            maxBytes: 20971520,
                            maxBytesPerPartition: 20971520,
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicAsicsService],
    controllers: [EpicAsicsController],
})
export class EpicAsicsModule {
}
