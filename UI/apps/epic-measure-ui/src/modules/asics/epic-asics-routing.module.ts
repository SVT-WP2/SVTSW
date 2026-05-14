import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import {
    EpicAsicDetailsPageComponent,
    EpicAsicOverviewPageComponent,
    EpicAsicsInfiniteListPageComponent,
    EpicAsicsListPageComponent,
    EpicAsicVoltageScanPageComponent,
} from './pages'


const routes: Routes = [
    {
        path: 'list-legacy',
        component: EpicAsicsListPageComponent,
    },
    {
        path: 'list',
        component: EpicAsicsInfiniteListPageComponent,
    },
    {
        path: 'details/:asicId',
        component: EpicAsicDetailsPageComponent,
        children: [
            {
                path: 'overview',
                component: EpicAsicOverviewPageComponent,
            },
            {
                path: 'threshold-scan',
                component: EpicAsicOverviewPageComponent,
            },
            {
                path: 'noise-test',
                component: EpicAsicOverviewPageComponent,
            },
            {
                path: 'voltage-scan',
                component: EpicAsicVoltageScanPageComponent,
            },
            {
                path: 'register-scan',
                component: EpicAsicOverviewPageComponent,
            },
            {
                path: '**',
                redirectTo: 'voltage-scan',
            },
        ],
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
export class EpicAsicsRoutingModule {

}
