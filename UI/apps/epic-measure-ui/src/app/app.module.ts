import { CommonModule } from '@angular/common'
import { HttpBackend, provideHttpClient } from '@angular/common/http'
import { isDevMode, NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'
import { provideRouter, RouterOutlet, withComponentInputBinding } from '@angular/router'
import { environment } from '@env/environment'
import { provideRouterStore, routerReducer } from '@ngrx/router-store'
import { provideStore } from '@ngrx/store'
import { provideStoreDevtools } from '@ngrx/store-devtools'
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core'
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { EpicAuthService } from 'epic-ui/common/auth'
import { EpicMenuLightModule, EpicNotificationModule, provideEpicDefaultIcons } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicAsicCreateDialogService, EpicAsicDeleteDialogService, EpicAsicsStoreFacade } from 'epic-ui/shared/asics'
import { provideEpicSvtTestTypesStore } from 'epic-ui/shared/svt-test/test-types'
import { provideEpicSvtTestSetupsStore } from 'epic-ui/shared/svt-tests'
import { provideEpicWaferTestsStore } from 'epic-ui/shared/wafer-tests'
import { provideEpicWaferTypesStore } from 'epic-ui/shared/wafer-types'
import { EpicWaferDeleteDialogService, EpicWafersStoreFacade } from 'epic-ui/shared/wafers'
import { provideEpicWpStore } from 'epic-ui/shared/wp'
import { provideSystemColors } from 'epic-ui/utils/colors'
import { getMatDefaultProviders } from 'epic-ui/utils/material'
import { storeFreeze } from 'ngrx-store-freeze'
import { provideEchartsCore } from 'ngx-echarts'

import { AppComponent } from './app.component'
import { provideMockData } from './app.mock.providers'
import { routes } from './app.routes'
import { AppMock, TranslateLoaderFactory } from './models'


echarts.use([BarChart, LineChart, GaugeChart, PieChart, LegendComponent, TooltipComponent, GridComponent, CanvasRenderer])

@NgModule({
    declarations: [
        AppComponent,
    ],
    bootstrap: [AppComponent],
    imports: [
        // NG
        CommonModule,
        BrowserModule,
        BrowserAnimationsModule,
        RouterOutlet,
        // Material Design
        MatMenuModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        // epic common
        EpicMenuLightModule,
        EpicLayoutLightModule,
        EpicNotificationModule,
    ],
    providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideAnimationsAsync(),
        provideEchartsCore({ echarts }),
        provideSystemColors(),
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'outline',
                floatLabel: 'always',
            } as MatFormFieldDefaultOptions,
        },
        provideHttpClient(),
        provideTranslateService({
            loader: {
                provide: TranslateLoader,
                useFactory: TranslateLoaderFactory,
                deps: [HttpBackend],
            },
            defaultLanguage: 'en',
        }),
        provideEpicDefaultIcons(),
        ...getMatDefaultProviders(),
        EpicAuthService,
        EpicWaferDeleteDialogService,
        EpicAsicCreateDialogService,
        EpicAsicDeleteDialogService,
        // NGRX
        provideStore(
            {
                router: routerReducer,
            },
            {
                metaReducers: !environment.production
                    ? [storeFreeze]
                    : [],
            }),
        provideRouterStore(),
        provideStoreDevtools({
            maxAge: 25, // Retains last 25 states
            logOnly: !isDevMode(), // Restrict extension to log-only mode
            autoPause: true, // Pauses recording actions and state changes when the extension window is not open
            //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping
            //  directly to that part of code
            trace: false,
            traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
            connectInZone: true, // If set to true, the connection is established within the Angular zone
        }),
        // ./NGRX
        provideEpicWaferTypesStore(),
        provideEpicWaferTestsStore(),
        provideEpicWpStore(),
        provideEpicSvtTestSetupsStore(),
        provideEpicSvtTestTypesStore(),
        EpicWafersStoreFacade,
        EpicAsicsStoreFacade,
        ...(environment.useMockData || AppMock.getMockSettings().useMockData ? provideMockData() : []),
    ],
})
export class AppModule {

}
