export type EpicWsMessage<TData, TEventName extends string = string> = {
    readonly eventName: TEventName
    readonly data?: TData
}
