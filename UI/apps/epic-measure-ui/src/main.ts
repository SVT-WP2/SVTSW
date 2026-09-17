import { enableProdMode, provideZoneChangeDetection } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'
import { environment } from '@env/environment'


import { AppModule } from './app/app.module'


if (environment.production) {
    enableProdMode()
}
//
platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()] })
    .catch(err => console.error(err))


// bootstrapApplication(AppComponent, appConfig)
//     .catch((err) => console.error(err))
