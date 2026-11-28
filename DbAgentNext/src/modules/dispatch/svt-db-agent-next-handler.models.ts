import { DiscoveryService } from '@nestjs/core'


/** What the agent knows about a request beyond its body. */
export type SvtDbAgentNextRequestContext = {
    /** The user of the header `svt_userId`; `null` when the request has no such header. */
    userId: number | null
}

/**
 * One message type the agent reacts to: the request `type`, the reply `type`, and the function. A handler that does
 * not need the context of the request takes one argument: TypeScript accepts a function with fewer parameters.
 */
export type SvtDbAgentNextHandlerDefinition<TData = unknown, TReply = unknown> = {
    type: string
    replyType: string
    handle: (data: TData, context: SvtDbAgentNextRequestContext) => Promise<TReply>
}

/** Implemented by every handlers class; the dispatcher collects the definitions at startup. */
export interface SvtDbAgentNextMessageHandlers {
    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<any, any>[]
}

/**
 * Marks a provider as a handlers class. The dispatcher discovers every marked provider of the application
 * (`DiscoveryService`), so a new domain only adds its module; nothing is wired by hand.
 */
export const SvtDbAgentNextHandlers = DiscoveryService.createDecorator()
