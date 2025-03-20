#ifndef EPIC_UTILITIES_H
#define EPIC_UTILITIES_H

/*!
 * @file EpicUtilities.h
 * @author Y. Corrales <ycorrale@cern.ch>
 * @date Mar-2025
 * @brief Utilities
 */

#include <string>

namespace EpicDbAgent
{
  extern std::string db_schema;
};  // namespace EpicDbAgent

template <typename T>
class Singleton
{
 public:
  // Public method to get the singleton instance
  static T &instance()
  {
    static T instance;  // Static instance of type T
    return instance;
  }

  // Prevent copying and assignment
  Singleton(const Singleton &) = delete;
  Singleton &operator=(const Singleton &) = delete;

 private:
  // Private constructor
  Singleton() {}
};

#endif  // !EPIC_UTILITIES_H
