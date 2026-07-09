import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicChipBlocksController } from './controllers'
import { EpicChipBlocksSvc } from './models'
import { EpicChipBlocksService } from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicChipBlocksSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.chip-blocks',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.chip-blocks',
                            maxBytes: 20971520,
                            maxBytesPerPartition: 20971520,
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicChipBlocksService],
    controllers: [EpicChipBlocksController],
})
export class EpicChipBlocksModule {
}
