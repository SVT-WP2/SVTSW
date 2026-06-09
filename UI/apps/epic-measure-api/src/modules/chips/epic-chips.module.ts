import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicChipsController } from './controllers'
import { EpicChipsService } from './epic-chips.service'
import { EpicChipsSvc } from './models'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicChipsSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.chips',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.chips',
                            maxBytes: 20971520,
                            maxBytesPerPartition: 20971520,
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicChipsService],
    controllers: [EpicChipsController],
})
export class EpicChipsModule {
}
