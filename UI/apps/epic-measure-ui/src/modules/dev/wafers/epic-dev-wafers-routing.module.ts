import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import {
    EpicDevWafersPageComponent,
    EpicDevWafersCreatePageComponent,
    EpicDevWaferTypeDetailsPageComponent,
    EpicDevFilePickerPageComponent,
} from './pages'


const routes: Routes = [
    {
        path: '',
        component: EpicDevWafersPageComponent,
        children: [
            {
                path: 'create',
                component: EpicDevWafersCreatePageComponent,
            },
            {
                path: 'wafer-type-details',
                component: EpicDevWaferTypeDetailsPageComponent,
            },
            {
                path: 'file-picker',
                component: EpicDevFilePickerPageComponent,
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'create',
            },
        ],
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'create',
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
export class EpicDevWafersRoutingModule {

}
