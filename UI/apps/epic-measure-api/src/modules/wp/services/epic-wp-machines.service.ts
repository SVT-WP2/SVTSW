import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicWpMachineUpdateInstalledProbeCard,
    EpicWpMachineUpdateLoadedWafer,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaWpMachines,
} from 'epic/entities'
import { EpicWpMachine, EpicWpMachineCreateRequest, EpicWpMachineUpdateRequest } from 'epic-api-types'
import { Observable } from 'rxjs'

import { EpicWpSvc } from '../models'


@Injectable()
export class EpicWpMachinesService implements OnModuleInit {

    constructor(
        @Inject(EpicWpSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicWpMachine[]> {
        const message = new SvtDbAgentKafkaWpMachines.GetAllWpMachinesMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpMachines.GetAllWpMachinesReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicWpMachineCreateRequest): Observable<EpicWpMachine> {
        const message = new SvtDbAgentKafkaWpMachines.CreateWpMachineMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpMachines.CreateWpMachineReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    update(entityId: number, updateRequest: EpicWpMachineUpdateRequest): Observable<EpicWpMachine> {
        const message = new SvtDbAgentKafkaWpMachines.UpdateWpMachineMessage({ id: entityId, update: updateRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpMachines.UpdateWpMachineReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    updateLoadedWafer(payload: EpicWpMachineUpdateLoadedWafer): Observable<EpicWpMachine> {
        const message = new SvtDbAgentKafkaWpMachines.UpdateWpMachineLoadedWaferMessage(payload)
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpMachines.UpdateWpMachineLoadedWaferReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    updateInstalledProbeCard(payload: EpicWpMachineUpdateInstalledProbeCard): Observable<EpicWpMachine> {
        const message = new SvtDbAgentKafkaWpMachines.UpdateWpMachineInstalledProbeCardMessage(payload)
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpMachines.UpdateWpMachineInstalledProbeCardReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaWpMachines.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
