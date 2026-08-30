import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import {
    EpicAsicDetailsPageComponent,
    EpicAsicSvtTestsPageComponent,
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
                path: 'svt-tests',
                component: EpicAsicSvtTestsPageComponent,
            },
            {
                path: 'voltage-scan',
                component: EpicAsicVoltageScanPageComponent,
            },
            {
                path: '**',
                redirectTo: 'svt-tests',
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
