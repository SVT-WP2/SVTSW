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
#include "SvtUtilities.h"

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
void SvtKafka::SvtKafkaAdminClient::createTopics(const SvtKafka::SvtKafkaAdminClient::Map &topicMap, const SvtUtils::RecreateTopics &action)
{
  //! get list of topics
  const auto &topics = mAdminClient->listTopics().topics;
  for (const auto &[topicName, topicProps] : topicMap)
  {
    bool createTopic = false;

    //! if topic exists delete Topic
    const auto &topicExists = topics.find(topicName) != topics.end();
    if (!topicExists)  // if not exists create it
    {
      createTopic = true;
    }
    else
    {
      if ((action == SvtUtils::ALL) || (action == SvtUtils::HEARTBEAT_ONLY && topicName == "svt.db-agent.heartbeat"))
      {
        logWarning("Deleting topic " + topicName);
        const auto &deleteTopic = mAdminClient->deleteTopics({topicName});
        createTopic = true;
      }
    }

    if (createTopic)
    {
      logWarning("Creating topic " + topicName);
      mAdminClient->createTopics({topicName}, 1, 1, topicProps);
    }
  }
}
