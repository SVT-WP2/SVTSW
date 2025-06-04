# Kafka

## Conventions

### Topic Name Format
- dash-case
- section separator: `.`
- example: `service-name.group-name.event-name.suffix`, `svt.db-agent.request`


### Message Structure

- message body: **is stringified JSON**
- key naming: **camelCased first lower**
- message structure
``` 
{
  type: string // some enum,
  data?: { [key: string]: unknown } // some JSON, NOT REQUIRED
}
```

### Request/Reply

Request-reply communication is ensured with the relevant headers and defined message structure.

#### Request
```
// REFERENCE HEADER NAMES

const KAFKA_HEADER__CORRELATION_ID    = 'kafka_correlationId'
const KAFKA_HEADER__REPLY_TOPIC       = 'kafka_replyTopic'
const KAFKA_HEADER__REPLY_PARTITION   = 'kafka_replyPartition'
```
#### Request Message

```
// REQUEST MESSAGE

Topic Name: 'svt.db-agent.request'
Headers:
{
  // some UUID string, this is kind of unique message id
  'kafka_correlationId': '1647f30ff6d9acbea7ce5',
  // reply topic name format: *.reply
  'kafka_replyTopic': 'svt.db-agent.request.reply',
  // just current sender service partition
  'kafka_replyPartition': 0, 
}

Message: 
{
  type: string // some enum,
  data?: { [key: string]: unknown } // some JSON, NOT REQUIRED
}
```
#### Reply Message

```
// REPLY MESSAGE

Headers:
{
  'kafka_correlationId': '1647f30ff6d9acbea7ce5',
  'kafka_replyPartition': 0, 
}

Message: EcpiDbAgentRequestReplyMessage // see definition below

//
// MESSAGE FORMAT
//

// - Each message has the next structure
// - type of the message defines the structure of the data field

type EcpiDbAgentRequestMessage {
  type: string // some enum,
  data: { [key: string]: unknown } // some JSON
}

type EcpiDbAgentRequestReplyMessage {
  status: EcpiDbAgentMessageStatus // Ok, BadRequest, NotFound, ...
  type: string // some enum,
  data?: { [key: string]: unknown } // some JSON, NOT REQUIRED
  error?: {
    code?: number // in ideal case we can define the list of posible errors
    message: string | string[] // error message
  }
}

enum EcpiDbAgentMessageStatus {
  // sucess
  Success = 'Success',
  // message data has invalid format
  BadRequest = 'BadRequest', 
  // requested entity does not exist 
  NotFound = 'NotFound', 
  // is not able to process the request, some unexpected error
  UnexpectedError = 'UnexpectedError', 
}

// EXAMPLE OF ERROR REPLY

Message: {
  status: 'UnexpectedError',
  error: {
    message: "Unable to precess request, something happen ...",
  }
}

```


