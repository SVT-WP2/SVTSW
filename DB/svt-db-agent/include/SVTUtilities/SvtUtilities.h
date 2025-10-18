#pragma once

/*!
 * @file SvtUtilities.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Utilities
 */

#include <nlohmann/json.hpp>

#include <cstdlib>
#include <memory>

template <typename T>
inline void clearVector(std::vector<T> &vec)
{
  std::vector<T>().swap(vec);
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
