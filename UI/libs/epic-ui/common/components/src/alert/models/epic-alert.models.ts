export namespace EpicAlert {

    export type Severity =
        | 'neutral'
        | 'info'
        | 'success'
        | 'error'
        | 'warning'

    export const Severity = {
        neutral: 'neutral' as Severity,
        info: 'info' as Severity,
        success: 'success' as Severity,
        error: 'error' as Severity,
        warning: 'warning' as Severity,
    }

}
