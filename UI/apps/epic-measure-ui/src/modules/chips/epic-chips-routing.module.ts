import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { EpicChipDetailsPageComponent, EpicChipsInfiniteListPageComponent } from './pages'


const routes: Routes = [
    {
        path: 'list',
        component: EpicChipsInfiniteListPageComponent,
    },
    {
        path: 'details/:chipId',
        component: EpicChipDetailsPageComponent,
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
export class EpicChipsRoutingModule {

}
