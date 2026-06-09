import {
    AfterViewInit,
    Component,
    ComponentRef,
    computed,
    effect,
    input,
    output,
    signal,
    Type,
    viewChild,
    ViewContainerRef,
} from '@angular/core'
import { BaseComponent, EpicSafeHtmlPipe, GenericEventInfo, TypeHelpers } from 'epic-ui/utils'

import { EpicContentRendererFactory, IEpicContentRendererComponent } from '../../models'


@Component({
    selector: 'epic-generic-content-renderer',
    templateUrl: './epic-generic-content-renderer.component.html',
    imports: [
        EpicSafeHtmlPipe,
    ],
})
export class EpicGenericContentRendererComponent<TParams = unknown, TEvent extends GenericEventInfo = GenericEventInfo>
    extends BaseComponent implements AfterViewInit {

    readonly params = input.required<TParams>()
    readonly factory = input.required<EpicContentRendererFactory<TParams, TEvent>>()

    readonly event = output<TEvent>()

    readonly componentPlaceholderViewRef
        = viewChild('componentPlaceholderViewRef', { read: ViewContainerRef })

    readonly factoryResult = computed<string | Type<IEpicContentRendererComponent<TParams, TEvent>>>(() => (
        this.factory()(this.params())
    ))

    readonly isPlainText = computed<boolean>(() => {
        return TypeHelpers.isString(this.factoryResult())
    })

    readonly plainText = computed<string | null>(() => {
        return this.isPlainText()
            ? this.factoryResult() as string
            : null
    })

    readonly componentType = computed<Type<IEpicContentRendererComponent<TParams, TEvent>> | null>(() => {
        return !this.isPlainText()
            ? this.factoryResult() as Type<IEpicContentRendererComponent<TParams, TEvent>>
            : null
    })

    private componentRef = signal<ComponentRef<IEpicContentRendererComponent<TParams, TEvent>> | null>(null)

    constructor() {
        super()
        effect(() => {
            const params = this.params()
            const componentRef = this.componentRef()
            if (componentRef) {
                this.syncComponentInputs(componentRef, params)
            }
        })
    }

    ngAfterViewInit(): void {
        if (!this.isPlainText()) {
            this.renderComponent()
        }
    }

    private renderComponent(): void {
        const componentRef = this.componentPlaceholderViewRef()!.createComponent(this.componentType()!)
        this.componentRef.set(componentRef)

        componentRef.instance.event
            .subscribe((event) => {
                this.event.emit(event)
            })

    }

    private syncComponentInputs(componentRef: ComponentRef<IEpicContentRendererComponent<TParams, TEvent>>, params: TParams): void {
        componentRef.setInput('params', params)
        componentRef.changeDetectorRef.markForCheck()
    }


}
