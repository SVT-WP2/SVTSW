import { ChangeDetectionStrategy, Component, Input } from '@angular/core'


@Component({
    selector: 'epic-select-option-no-result',
    templateUrl: './epic-select-option-no-result.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
export class EpicSelectOptionNoResultComponent {

    @Input() text = 'COMMON.NO_RESULTS'

}
