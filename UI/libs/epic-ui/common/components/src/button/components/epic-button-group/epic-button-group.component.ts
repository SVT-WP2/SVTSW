import { ChangeDetectionStrategy, Component } from '@angular/core'


@Component({
    selector: 'epic-button-group,[epic-button-group]',
    templateUrl: './epic-button-group.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
})
export class EpicButtonGroupComponent {

}
