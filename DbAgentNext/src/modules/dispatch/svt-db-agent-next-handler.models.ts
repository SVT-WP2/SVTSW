import { DiscoveryService } from '@nestjs/core'


/** One message type the agent reacts to: the request `type`, the reply `type`, and the function. */
export type SvtDbAgentNextHandlerDefinition<TData = unknown, TReply = unknown> = {
    type: string
    replyType: string
    handle: (data: TData) => Promise<TReply>
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
