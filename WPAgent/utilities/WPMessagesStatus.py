from enum import Enum


class WPMessagesStatus(str, Enum):
    Success = "Success"
    BadRequest = "BadRequest"
    NotFound = "NotFound"
    UnexpectedError = "UnexpectedError"
