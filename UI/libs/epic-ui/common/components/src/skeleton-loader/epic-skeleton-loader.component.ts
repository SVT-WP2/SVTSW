import { ChangeDetectionStrategy, Component, input } from '@angular/core'

import { EpicSkeletonLoader } from './epic-skeleton-loader.models'


@Component({
    selector: 'epic-skeleton-loader',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'epic-skeleton-loader',
        '[class.epic-skeleton-loader--size-sm]': 'size() === Size.sm',
        '[class.epic-skeleton-loader--size-md]': 'size() === Size.md',
        '[class.epic-skeleton-loader--size-lg]': 'size() === Size.lg',
        '[class.epic-skeleton-loader--size-xl]': 'size() === Size.xl',
        '[style.width]': 'width()',
    },
})
export class EpicSkeletonLoaderComponent {

    readonly size = input<EpicSkeletonLoader.Size>(EpicSkeletonLoader.Size.md)
    readonly width = input<string>('100%')

    readonly Size = EpicSkeletonLoader.Size

}
