import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'

import { EpicEquipmentController, EpicEquipmentTypesController } from './controllers'
import { EpicEquipmentSvc } from './models'
import { EpicEquipmentService, EpicEquipmentTypesService } from './services'


@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: EpicEquipmentSvc.SERVICE_NAME,
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'epic-ui.equipment',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {},
                        consumer: {
                            groupId: 'epic-ui.equipment',
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [EpicEquipmentTypesService, EpicEquipmentService],
    controllers: [EpicEquipmentTypesController, EpicEquipmentController],
})
export class EpicEquipmentsModule {
}
