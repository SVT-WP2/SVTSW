import { EpicRecord } from './generic-types.models'


export type GenericEventInfoBase<TData extends EpicRecord = EpicRecord, TEventName = string> = {
    readonly eventName: TEventName
    data?: TData
}

export type GenericEventInfo<TEventName = string, TData extends EpicRecord = EpicRecord> =
    & GenericEventInfoBase<TData, TEventName>
    & EpicRecord

export abstract class BaseGenericEventInfoClass<TEventName = string, TData extends EpicRecord = EpicRecord>
implements GenericEventInfoBase<TData, TEventName> {

    readonly eventName!: TEventName

    constructor(public data: TData) {
    }

}
