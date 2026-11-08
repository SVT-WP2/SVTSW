import { Module } from '@nestjs/common'
import { SvtDbDataModule } from 'svt-db/data'

import { SvtDbAgentNextAsicsHandlers } from './asics'
import { SvtDbAgentNextChipBlocksHandlers } from './chip-blocks'
import { SvtDbAgentNextChipsHandlers } from './chips'
import { SvtDbAgentNextEnumsHandlers } from './enums'
import { SvtDbAgentNextEquipmentHandlers } from './equipment'
import { SvtDbAgentNextEquipmentTypesHandlers } from './equipment-types'
import { SvtDbAgentNextSvtTestSetupConfigsHandlers } from './svt-test-setup-configs'
import { SvtDbAgentNextSvtTestSetupsHandlers } from './svt-test-setups'
import { SvtDbAgentNextSvtTestTemplatesHandlers } from './svt-test-templates'
import { SvtDbAgentNextSvtTestTypeConfigsHandlers } from './svt-test-type-configs'
import { SvtDbAgentNextSvtTestTypesHandlers } from './svt-test-types'
import { SvtDbAgentNextSvtTestsHandlers } from './svt-tests'
import { SvtDbAgentNextWaferTypesHandlers } from './wafer-types'
import { SvtDbAgentNextWafersHandlers } from './wafers'
import { SvtDbAgentNextWpMachinesHandlers } from './wp-machines'
import { SvtDbAgentNextWpProbeCardsHandlers } from './wp-probe-cards'
import { SvtDbAgentNextWpProjectsHandlers } from './wp-projects'


/**
 * One provider per domain, each marked with `@SvtDbAgentNextHandlers()`; the dispatcher discovers them.
 * Each slice adds a domain here, together with its e2e spec.
 */
@Module({
    imports: [SvtDbDataModule],
    providers: [
        SvtDbAgentNextEnumsHandlers,
        SvtDbAgentNextWaferTypesHandlers,
        SvtDbAgentNextWafersHandlers,
        SvtDbAgentNextAsicsHandlers,
        SvtDbAgentNextChipsHandlers,
        SvtDbAgentNextChipBlocksHandlers,
        SvtDbAgentNextWpMachinesHandlers,
        SvtDbAgentNextWpProbeCardsHandlers,
        SvtDbAgentNextWpProjectsHandlers,
        SvtDbAgentNextEquipmentTypesHandlers,
        SvtDbAgentNextEquipmentHandlers,
        SvtDbAgentNextSvtTestSetupsHandlers,
        SvtDbAgentNextSvtTestSetupConfigsHandlers,
        SvtDbAgentNextSvtTestTypesHandlers,
        SvtDbAgentNextSvtTestTypeConfigsHandlers,
        SvtDbAgentNextSvtTestTemplatesHandlers,
        SvtDbAgentNextSvtTestsHandlers,
    ],
})
export class SvtDbAgentNextHandlersModule {
}
