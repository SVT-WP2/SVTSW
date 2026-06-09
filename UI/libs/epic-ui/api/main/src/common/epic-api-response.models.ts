export type EpicApiResponse<T = unknown> = {
    payload: T
    validationErrors?: []
    errors?: []
}
