import { Module } from '@nestjs/common'
import { SvtDbDataModule } from 'svt-db/data'

import { SvtDbAgentNextEnumsHandlers } from './enums'
import { SvtDbAgentNextWaferTypesHandlers } from './wafer-types'


/**
 * One provider per domain, each marked with `@SvtDbAgentNextHandlers()`; the dispatcher discovers them.
 * Phase 3 adds a domain per slice, together with its e2e spec.
 */
@Module({
    imports: [SvtDbDataModule],
    providers: [
        SvtDbAgentNextEnumsHandlers,
        SvtDbAgentNextWaferTypesHandlers,
    ],
})
export class SvtDbAgentNextHandlersModule {
}
