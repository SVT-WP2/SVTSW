import { Module } from '@nestjs/common'

import { SvtDbAsicsRepository } from './asics'
import { SvtDbChipBlocksRepository, SvtDbChipsRepository } from './chips'
import { SvtDbEnumsService } from './enums'
import { SvtDbEquipmentRepository, SvtDbEquipmentTypesRepository } from './equipment'
import { SvtDbSvtTestSetupConfigsRepository, SvtDbSvtTestSetupsRepository } from './svt-test-setups'
import {
    SvtDbSvtTestTemplatesRepository,
    SvtDbSvtTestTypeConfigsRepository,
    SvtDbSvtTestTypesRepository,
} from './svt-test-types'
import { SvtDbSvtTestsRepository } from './svt-tests'
import { SvtDbWaferTypesRepository } from './wafer-types'
import { SvtDbWafersRepository } from './wafers'
import { SvtDbWpMachinesRepository, SvtDbWpProbeCardsRepository, SvtDbWpProjectsRepository } from './wp'


const PROVIDERS = [
    SvtDbEnumsService,
    SvtDbWaferTypesRepository,
    SvtDbWafersRepository,
    SvtDbAsicsRepository,
    SvtDbChipsRepository,
    SvtDbChipBlocksRepository,
    SvtDbWpMachinesRepository,
    SvtDbWpProbeCardsRepository,
    SvtDbWpProjectsRepository,
    SvtDbEquipmentTypesRepository,
    SvtDbEquipmentRepository,
    SvtDbSvtTestSetupsRepository,
    SvtDbSvtTestSetupConfigsRepository,
    SvtDbSvtTestTypesRepository,
    SvtDbSvtTestTypeConfigsRepository,
    SvtDbSvtTestTemplatesRepository,
    SvtDbSvtTestsRepository,
]

/**
 * The repositories and services of the data layer, for the application's handler modules. Needs
 * `SvtDbOrmModule.forRoot` (global) for the `EntityManager`. Each slice appends its repository.
 */
@Module({
    providers: PROVIDERS,
    exports: PROVIDERS,
})
export class SvtDbDataModule {
}
