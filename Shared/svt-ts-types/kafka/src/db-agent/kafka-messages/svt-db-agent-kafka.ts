export namespace SvtDbAgentKafka {

    export enum TopicName {
        Request = 'svt.db-agent.request',
        RequestReply = 'svt.db-agent.request.reply',
    }

    export type ListReplyMessageData<T = unknown> = {
        items: T[]
        totalCount?: number
    }

    export type PageReplyMessageData<T = unknown> = {
        items: T[]
        totalCount: number
    }

    export type OneEntityReplyMessageData<T = unknown> = {
        entity: T
    }

}
