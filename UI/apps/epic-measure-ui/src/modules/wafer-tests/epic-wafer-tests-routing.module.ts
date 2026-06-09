import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { EpicWaferTestDetailsPageComponent, EpicWaferTestsListPageComponent } from './pages'


const routes: Routes = [
    {
        path: 'list',
        component: EpicWaferTestsListPageComponent,
    },
    {
        path: 'details/:waferTestId',
        component: EpicWaferTestDetailsPageComponent,
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
export class EpicWaferTestsRoutingModule {

}
