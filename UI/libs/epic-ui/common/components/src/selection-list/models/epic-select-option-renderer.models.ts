import { SelectOptionLabelValue } from 'epic-ui/utils'

import { IEpicContentRendererComponent, EpicContentRendererFactory } from '../../content-renderer'


export type EpicSelectOptionRendererParams<TValue = string, TData = unknown> = {
    isSelected: boolean
    option: SelectOptionLabelValue<TValue, TData>
}

export type IEpicSelectOptionRendererComponent<TValue = string, TData = unknown> =
    IEpicContentRendererComponent<EpicSelectOptionRendererParams<TValue, TData>>

export type EpicSelectOptionRendererFactory<TValue = unknown, TData = unknown>
    = EpicContentRendererFactory<EpicSelectOptionRendererParams<TValue, TData>>
