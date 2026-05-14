import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicDbAgentWafersController } from './controllers'
import { EpicDbAgent } from './epic-db-agent.models'
import {
    EpicDbAgentAsicsService,
    EpicDbAgentChipsService,
    EpicDbAgentEnumsService,
    EpicDbAgentEquipmentService,
    EpicDbAgentEquipmentTypesService,
    EpicDbAgentSvtTestSetupConfigsService,
    EpicDbAgentSvtTestSetupService,
    EpicDbAgentSvtTestTemplatesService,
    EpicDbAgentSvtTestTypeConfigsService,
    EpicDbAgentSvtTestTypesService,
    EpicDbAgentWafersService,
    EpicDbAgentWaferTypesService,
    EpicDbAgentWpMachinesService,
    EpicDbAgentWpProbeCardsService,
    EpicDbAgentWpProjectsService,
} from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicDbAgent.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.fake-db-agent',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.fake-db-agent',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [
        EpicDbAgentWafersService,
        EpicDbAgentAsicsService,
        EpicDbAgentWaferTypesService,
        EpicDbAgentWpMachinesService,
        EpicDbAgentEnumsService,
        EpicDbAgentWpProbeCardsService,
        EpicDbAgentWpProjectsService,
        EpicDbAgentChipsService,
        EpicDbAgentEquipmentTypesService,
        EpicDbAgentEquipmentService,
        EpicDbAgentSvtTestSetupService,
        EpicDbAgentSvtTestSetupConfigsService,
        EpicDbAgentSvtTestTypesService,
        EpicDbAgentSvtTestTypeConfigsService,
        EpicDbAgentSvtTestTemplatesService,
    ],
    controllers: [EpicDbAgentWafersController],
})
export class EpicDbAgentModule {
}
