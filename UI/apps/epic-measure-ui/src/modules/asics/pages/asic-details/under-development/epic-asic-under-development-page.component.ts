import { Component } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'


/**
 * Stand-in for the ASIC tabs that have no page of their own yet. They used to point at the overview page,
 * which now shows the tests of the ASIC and would say something those tabs do not mean.
 */
@Component({
    selector: 'epic-asic-under-development-page',
    templateUrl: 'epic-asic-under-development-page.component.html',
    standalone: false,
})
export class EpicAsicUnderDevelopmentPageComponent extends BaseComponent {

}
