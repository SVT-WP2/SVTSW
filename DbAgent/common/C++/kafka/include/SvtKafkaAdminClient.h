#pragma once

/*!
 * @file SvtKafkaAdminClient.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Apr-2026
 * @brief Admin Client
 */

#include <kafka/Properties.h>
#include <memory>

#include <kafka/AdminClient.h>

namespace SvtKafka
{

  class SvtKafkaAdminClient
  {
   public:
    using Map = std::map<std::string, kafka::Properties>;

    SvtKafkaAdminClient(std::string_view broker);
    ~SvtKafkaAdminClient() = default;

    auto getAdmin() const { return mAdminClient.get(); }

    // void createTopics(const std::string& topic, const kafka::Properties& props);

   private:
    std::shared_ptr<kafka::clients::admin::AdminClient> mAdminClient;

    std::string mBroker;
  };
}  // namespace SvtKafka
