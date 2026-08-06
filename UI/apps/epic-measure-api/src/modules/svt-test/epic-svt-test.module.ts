import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import {
    EpicSvtTestSetupConfigsController,
    EpicSvtTestSetupsController,
    EpicSvtTestsController,
    EpicSvtTestTemplatesController,
    EpicSvtTestTypeConfigsController,
    EpicSvtTestTypesController,
} from './controllers'
import { EpicSvtTestSvc } from './models'
import {
    EpicSvtTestSetupConfigsService,
    EpicSvtTestSetupsService,
    EpicSvtTestsService,
    EpicSvtTestTemplatesService,
    EpicSvtTestTypeConfigsService,
    EpicSvtTestTypesService,
} from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicSvtTestSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.svt-test',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.svt-test',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [
        EpicSvtTestSetupsService,
        EpicSvtTestSetupConfigsService,
        EpicSvtTestTypesService,
        EpicSvtTestTypeConfigsService,
        EpicSvtTestTemplatesService,
        EpicSvtTestsService,
    ],
    controllers: [
        EpicSvtTestSetupsController,
        EpicSvtTestSetupConfigsController,
        EpicSvtTestTypesController,
        EpicSvtTestTypeConfigsController,
        EpicSvtTestTemplatesController,
        EpicSvtTestsController,
    ],
})
export class EpicSvtTestModule {
}
