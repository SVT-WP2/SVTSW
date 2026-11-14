import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { EpicEquipment, EpicEquipmentCreateRequest, EpicEquipmentLocationHistoryRecord } from 'epic-api-types'
import { EpicEquipmentLocationUpdate, SvtDbAgentKafka, SvtDbAgentKafkaEquipment } from 'epic-api-types/kafka'
import { Observable } from 'rxjs'

import { EpicEquipmentSvc } from '../models'


@Injectable()
export class EpicEquipmentService implements OnModuleInit {

    constructor(
        @Inject(EpicEquipmentSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicEquipment[]> {
        const message = new SvtDbAgentKafkaEquipment.GetAllEquipmentMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaEquipment.GetAllEquipmentReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicEquipmentCreateRequest): Observable<EpicEquipment> {
        const message = new SvtDbAgentKafkaEquipment.CreateEquipmentMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaEquipment.CreateEquipmentReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    getEquipmentLocationHistory(equipmentId: number): Observable<EpicEquipmentLocationHistoryRecord[]> {
        const message = new SvtDbAgentKafkaEquipment.GetEquipmentLocationHistoryMessage({ equipmentId })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaEquipment.GetEquipmentLocationHistoryReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    updateEquipmentLocation(equipmentId: number, update: EpicEquipmentLocationUpdate): Observable<EpicEquipment> {
        const message = new SvtDbAgentKafkaEquipment.UpdateEquipmentLocationMessage({
            equipmentId,
            ...update,
        })

        return this.sendMessageAndGetReply<SvtDbAgentKafkaEquipment.UpdateEquipmentLocationReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }


    onModuleInit(): void {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaEquipment.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
