import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { EpicChipBlockDetailsPageComponent, EpicChipBlocksInfiniteListPageComponent } from './pages'


const routes: Routes = [
    {
        path: 'list',
        component: EpicChipBlocksInfiniteListPageComponent,
    },
    {
        path: 'details/:chipBlockId',
        component: EpicChipBlockDetailsPageComponent,
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
export class EpicChipBlocksRoutingModule {

}
