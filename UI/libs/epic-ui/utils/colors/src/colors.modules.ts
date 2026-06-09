import { CommonModule } from '@angular/common'
import { ModuleWithProviders, NgModule, Provider } from '@angular/core'

import { ISystemColors, SYSTEM_COLORS, SystemColorsBlue } from './models'


export const DEFAULT_SYSTEM_COLORS = new SystemColorsBlue()

export function provideSystemColors(config?: { systemColors: ISystemColors }): Provider[] {
    return [
        {
            provide: SYSTEM_COLORS,
            useFactory: () => config ? config.systemColors : DEFAULT_SYSTEM_COLORS,
        },
    ]
}

@NgModule({
    imports: [
        CommonModule,
    ],
    providers: [
        {
            provide: SYSTEM_COLORS,
            useFactory: () => new SystemColorsBlue(),
        },
    ],
})
export class ColorsModule {

    static forRoot(config?: { systemColors: ISystemColors }): ModuleWithProviders<ColorsModule> {
        return {
            ngModule: ColorsModule,
            providers: [
                {
                    provide: SYSTEM_COLORS,
                    useFactory: () => config ? config.systemColors : new SystemColorsBlue(),
                },
            ],
        }
    }

}
