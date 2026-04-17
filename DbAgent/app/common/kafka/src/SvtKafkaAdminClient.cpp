/*!
 * @file SvtKafkaAdminClient.cpp
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2026
 * @brief Admin Client implementation
 */

#include <memory>
#include <string_view>

#include <kafka/AdminClient.h>

#include "SvtKafkaAdminClient.h"
#include "SvtLogger.h"

//========================================================================+
SvtKafka::SvtKafkaAdminClient::SvtKafkaAdminClient(std::string_view broker)
  : mBroker(broker)
{
  // Create adminClient
  kafka::Properties adminProps;
  adminProps.put("bootstrap.servers", mBroker);
  mAdminClient = std::make_unique<kafka::clients::admin::AdminClient>(adminProps);
};

//========================================================================+
void SvtKafka::SvtKafkaAdminClient::createTopics(const SvtKafka::SvtKafkaAdminClient::Map &topicMap)
{
  //! get list of topics
  const auto &topics = mAdminClient->listTopics().topics;
  for (const auto &[topicName, topicProps] : topicMap)
  {
    //! if topic exists delete Topic
    if (topics.find(topicName) != topics.end())
    {
      logWarning("Deleting topic " + topicName);
      const auto &deleteTopic = mAdminClient->deleteTopics({topicName});
    }
    logWarning("Creating topic " + topicName);
    mAdminClient->createTopics({topicName}, 1, 1, topicProps);
  }
}
