export interface IEpicKafkaMessage<TData extends Record<string, any> = Record<string, any>, TType extends string = string> {
    readonly type: TType
    readonly data?: TData
}

export type EpicKafkaMessage<TData extends Record<string, any> = Record<string, any>, TType extends string = string> = {
    type: TType
    data?: TData
}

export abstract class EpicKafkaMessageClass<TData extends Record<string, any> = Record<string, any>, TType extends string = string>
implements IEpicKafkaMessage<TData, TType> {

    abstract readonly type: TType

    constructor(readonly data: TData) {
    }

}
