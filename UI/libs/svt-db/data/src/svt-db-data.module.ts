import { Module } from '@nestjs/common'

import { SvtDbEnumsService } from './enums'
import { SvtDbWaferTypesRepository } from './wafer-types'
import { SvtDbWafersRepository } from './wafers'


/**
 * The repositories and services of the data layer, for the application's handler modules. Needs
 * `SvtDbOrmModule.forRoot` (global) for the `EntityManager`. Each slice appends its repository.
 */
@Module({
    providers: [
        SvtDbEnumsService,
        SvtDbWaferTypesRepository,
        SvtDbWafersRepository,
    ],
    exports: [
        SvtDbEnumsService,
        SvtDbWaferTypesRepository,
        SvtDbWafersRepository,
    ],
})
export class SvtDbDataModule {
}
