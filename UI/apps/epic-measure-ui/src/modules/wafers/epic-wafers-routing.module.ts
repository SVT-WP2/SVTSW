import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { EpicWaferDetailsPageComponent, EpicWafersListPageComponent } from './pages'


const routes: Routes = [
    {
        path: 'list',
        component: EpicWafersListPageComponent,
    },
    {
        path: 'details/:waferId',
        component: EpicWaferDetailsPageComponent,
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: '**',
        redirectTo: '/404',
    },
]

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ],
    exports: [RouterModule],
})
export class EpicWafersRoutingModule {

}
