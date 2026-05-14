import { Component } from '@angular/core'

import { AppSidebarNav } from './models'


@Component({
    selector: 'app-root',
    standalone: false,
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent {

    readonly sidebarMenu = AppSidebarNav.getSidebarMenu()

}
