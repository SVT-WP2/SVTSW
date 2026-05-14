import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicWpMachinesController, EpicWpProbeCardsController, EpicWpProjectsController } from './controllers'
import { EpicWpSvc } from './models'
import { EpicWpMachinesService, EpicWpProbeCardsService, EpicWpProjectsService } from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicWpSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.wp',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.wp',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicWpMachinesService, EpicWpProbeCardsService, EpicWpProjectsService],
    controllers: [EpicWpMachinesController, EpicWpProbeCardsController, EpicWpProjectsController],
})
export class EpicWpModule {
}
