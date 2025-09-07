#ifndef SVT_UTILITIES_H
#define SVT_UTILITIES_H

/*!
 * @file SvtUtilities.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Utilities
 */

#include <nlohmann/json.hpp>

#include <cstdlib>
#include <string>

namespace SvtDbAgent {
static std::string db_name = (getenv("SVT_DB_AGENT_DB_NAME") != nullptr)
                                 ? getenv("SVT_DB_AGENT_DB_NAME")
                                 : "svt_sw_db_test";
static std::string db_schema = (getenv("SVT_DB_AGENT_SCHEMA") != nullptr)
                                   ? getenv("SVT_DB_AGENT_SCHEMA")
                                   : "main";
static std::string kafka_server = (getenv("SVT_KAFKA_SERVER") != nullptr)
                                      ? getenv("SVT_KAFKA_SERVER")
                                      : "localhost";
static std::string kafka_port =
    (getenv("SVT_KAFKA_PORT") != nullptr) ? getenv("SVT_KAFKA_PORT") : "9092";

template <class T>
inline void get_v(const nlohmann::json &j, const char *key, T &val) {
  if (j.at(key).is_null()) {
    val = T{};
  } else {
    val = j.value(key, T{});
  }
}

template <typename T> inline void clearVector(std::vector<T> &vec) {
  std::vector<T>().swap(vec);
}

template <typename T> class Singleton {
public:
  // Public method to get the singleton instance
  static T &instance() {
    static T instance; // Static instance of type T
    return instance;
  }

  // Prevent copying and assignment
  Singleton(const Singleton &) = delete;
  Singleton &operator=(const Singleton &) = delete;

private:
  // Private constructor
  Singleton() {}
};
}; // namespace SvtDbAgent

#endif // !SVT_UTILITIES_H
