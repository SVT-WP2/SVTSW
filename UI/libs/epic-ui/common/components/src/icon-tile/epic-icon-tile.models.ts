export namespace EpicIconTile {

    export type Size = 'small' | 'basic' | 'large' | 'xl' | 'xxl'
    export const Size: Record<Size, Size> = {
        small: 'small',
        basic: 'basic',
        large: 'large',
        xl: 'xl',
        xxl: 'xxl',
    }

    export type Shape = 'circle' | 'square'
    export const Shape: Record<Shape, Shape> = {
        circle: 'circle',
        square: 'square',
    }

    const SIZE_CSS_CLASS_DIC: Readonly<Record<Size, string>> = Object.freeze({
        small: 'epic-icon-tile--small',
        basic: 'epic-icon-tile--basic',
        large: 'epic-icon-tile--large',
        xl: 'epic-icon-tile--xl',
        xxl: 'epic-icon-tile--xxl',
    })

    const SHAPE_CSS_CLASS_DIC: Readonly<Record<Shape, string>> = Object.freeze({
        circle: 'epic-icon-tile--circle',
        square: 'epic-icon-tile--square',
    })

    export function getSizeCssClass(size: Size): string {
        return SIZE_CSS_CLASS_DIC[size]
    }

    export function getShapeCssClass(shape: Shape): string {
        return SHAPE_CSS_CLASS_DIC[shape]
    }

    export function getCssClass(size: Size, shape: Shape): string {
        return SIZE_CSS_CLASS_DIC[size] + ' ' + SHAPE_CSS_CLASS_DIC[shape]
    }

}

