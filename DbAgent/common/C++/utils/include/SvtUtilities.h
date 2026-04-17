#pragma once

/*!
 * @file SvtUtilities.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Utilities
 */

#include <cstdlib>
#include <memory>
#include <sstream>
#include <string>

#include <nlohmann/json.hpp>

namespace SvtUtils
{
  enum RecreateTopics
  {
    HEARTBEAT_ONLY = 0,
    ALL
  };

  template <typename T>
  inline void clearVector(std::vector<T> &vec)
  {
    std::vector<T>().swap(vec);
  }

  //! Get current time since epoch
  inline std::string getCurrentTime()
  {
    auto epoch_time = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    auto sec = epoch_time / 1e6;
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(6) << sec;
    return oss.str();
  }

  template <typename T>
  class Singleton
  {
   public:
    // Public method to get the singleton instance
    static T *instance()
    {
      static std::unique_ptr<T> instance(new T);  // Static instance of type T
      return instance.get();
    }

   private:
    // Private constructor
    Singleton() = default;
    // Prevent copying and assignment
    Singleton(const Singleton &) = delete;
    Singleton &operator=(const Singleton &) = delete;
  };
}  // namespace SvtUtils
