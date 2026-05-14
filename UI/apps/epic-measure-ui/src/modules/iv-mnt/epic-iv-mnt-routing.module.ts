import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { EpicIvMntListPageComponent, EpicIvMntNewPageComponent } from './pages'


const routes: Routes = [
    {
        path: 'list',
        component: EpicIvMntListPageComponent,
    },
    {
        path: 'new',
        component: EpicIvMntNewPageComponent,
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
export class EpicIvMntRoutingModule {

}
