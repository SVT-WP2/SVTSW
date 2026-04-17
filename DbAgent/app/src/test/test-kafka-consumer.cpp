
#include <atomic>
#include <csignal>
#include <cstdlib>

#include <getopt.h>

#include <kafka/KafkaConsumer.h>
#include <kafka/Properties.h>

#include "SvtLogger.h"

static volatile std::atomic_bool running = {true};

using namespace kafka;
using namespace kafka::clients::consumer;
//========================================================================+
void stopRunning(int sig)
{
  if (sig != SIGINT && sig != SIGTERM) return;

  if (running)
  {
    std::ostringstream ss;
    ss << "Caught signal " << sig << ", initiating shutdown...";
    logWarning(ss.str());
    running = false;
  }
  else
  {
    // Restore the signal handler, -- to avoid stuck with this handler
    std::signal(SIGINT, SIG_IGN);   // Ctrl+C
    std::signal(SIGTERM, SIG_IGN);  // kill command
  }
}

int main(int argc, char **argv)
{
  // Register signal handlers for graceful shutdown
  // Use Ctrl-C to terminate the program
  std::signal(SIGINT, stopRunning);   // Ctrl+C
  std::signal(SIGTERM, stopRunning);  // kill command

  // Kafka broker address
  std::string broker = "localhost:9095";
  // Consumer group ID
  std::string group_id = "svt.db-agent.test ";
  // Topic to subscribe to
  std::string topic_name = "svt.db-agent.request";

  int opt;
  while ((opt = getopt(argc, argv, ":b:g:t:")) != -1)
  {
    switch (opt)
    {
    case 'b':
      broker = optarg;
      break;
    case 't':
      topic_name = optarg;
      break;
    case 'g':
      group_id = optarg;
      break;
    case ':':
    {
      std::ostringstream ss;
      ss << "Option -" << char(optopt) << " requires an operand";
      logError(ss.str());
      return EXIT_FAILURE;
      break;
    }
    case '?':
    {
      std::ostringstream ss;
      ss << "Unrecognized option: -" << char(optopt);
      logError(ss.str());
      return EXIT_FAILURE;
      break;
    }
    default:
      return EXIT_FAILURE;
      break;
    }
  }

  std::map<std::string, std::string> configs = {
      {"bootstrap.servers", broker},
      {"group.id", group_id},
      {"log_level", "4"},  // supress NOTICE log, set log_level = 4 (WARNING)
      {"auto.offset.reset", "latest"}};

  Properties props;
  for (const auto &[key, value] : configs)
  {
    props.put(key, value);
  }
  KafkaConsumer consumer(props);

  consumer.assign({{topic_name, 0}});

  // Start consuming messages
  logInfo("Consumer subscribed to topic " + topic_name + " in group " + group_id);
  logInfo("press Ctrl+C to stop.");

  while (running)
  {
    const auto &records = consumer.poll(std::chrono::milliseconds(100));

    for (const auto &record : records)
    {
      if (!record.error())
      {
        logInfo(record.toString());
      }
      else
      {
        logError(record.toString());
      }
    }
  }

  // Close and clean up
  consumer.close();

  closeLogFile();

  return EXIT_SUCCESS;
}
