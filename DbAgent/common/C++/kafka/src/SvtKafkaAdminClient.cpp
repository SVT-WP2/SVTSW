/*!
 * @file SvtKafkaAdminClient.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2026
 * @brief Admin Client implementation
 */

#include <kafka/Properties.h>
#include <memory>
#include <string_view>

#include <kafka/AdminClient.h>

#include "SvtKafkaAdminClient.h"

//========================================================================+
SvtKafka::SvtKafkaAdminClient::SvtKafkaAdminClient(std::string_view broker)
  : mBroker(broker)
{
  // Create adminClient
  kafka::Properties adminProps;
  adminProps.put("bootstrap.servers", mBroker);
  mAdminClient = std::make_shared<kafka::clients::admin::AdminClient>(adminProps);
};
