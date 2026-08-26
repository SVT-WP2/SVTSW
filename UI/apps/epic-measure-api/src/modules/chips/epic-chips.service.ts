import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicChipCreateManyRequestDto,
    EpicChipCreateRequestDto,
    EpicChipEntity,
    EpicChipLocationHistoryRecordEntity,
    EpicChipLocationUpdate,
    EpicGetAllChipsQueryFilter,
    EpicPageData,
    EpicPager,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaChips,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicChipsSvc } from './models'

// TODO: process reply errors
@Injectable()
export class EpicChipsService implements OnModuleInit {

    constructor(
        @Inject(EpicChipsSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(
        queryFilter?: EpicGetAllChipsQueryFilter,
        pager?: EpicPager): Observable<EpicPageData<EpicChipEntity>> {
        const data: SvtDbAgentKafkaChips.GetAllChipsMessageData = {
            filter: {
                ...(queryFilter?.ids ? { ids: queryFilter.ids } : {}),
                ...(queryFilter?.familyTypes ? { familyTypes: queryFilter.familyTypes } : {}),
                ...(queryFilter?.generalLocation ? { generalLocation: queryFilter.generalLocation } : {}),
                ...(queryFilter?.serialNumber ? { serialNumber: queryFilter.serialNumber } : {}),
            },
            pager: {
                limit: 20,
                offset: 0,
                ...(pager || {}),
            },
        }

        const message = new SvtDbAgentKafkaChips.GetAllChipsMessage(data)
        return this.sendMessageAndGetReply<SvtDbAgentKafkaChips.GetAllChipsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
            )
    }

    create(createRequest: EpicChipCreateRequestDto): Observable<EpicChipEntity> {
        const message = new SvtDbAgentKafkaChips.CreateChipMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaChips.CreateChipReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    createMany(createRequest: EpicChipCreateManyRequestDto): Observable<EpicChipEntity[]> {
        const message = new SvtDbAgentKafkaChips.CreateManyChipsMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaChips.CreateManyChipsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    getChipLocationHistory(chipId: number): Observable<EpicChipLocationHistoryRecordEntity[]> {
        const message = new SvtDbAgentKafkaChips.GetChipLocationHistoryMessage({ chipId })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaChips.GetChipLocationHistoryReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    updateChipLocation(chipId: number, update: EpicChipLocationUpdate): Observable<EpicChipEntity> {
        const message = new SvtDbAgentKafkaChips.UpdateChipLocationMessage({
            chipId,
            ...update,
        })

        return this.sendMessageAndGetReply<SvtDbAgentKafkaChips.UpdateChipLocationReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaChips.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
