import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { EpicEquipmentType, EpicEquipmentTypeCreateRequest } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaEquipmentTypes } from 'epic-api-types/kafka'
import { Observable } from 'rxjs'

import { EpicEquipmentSvc } from '../models'


@Injectable()
export class EpicEquipmentTypesService implements OnModuleInit {

    constructor(
        @Inject(EpicEquipmentSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicEquipmentType[]> {
        const message = new SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicEquipmentTypeCreateRequest): Observable<EpicEquipmentType> {
        const message = new SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }


    onModuleInit(): void {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaEquipmentTypes.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
