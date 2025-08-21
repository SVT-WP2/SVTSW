#include "Database/multitype.h"

template <typename Type>
MultiType<Type>::MultiType(Type val)
{
  this->value = val;
}

// template <typename Type>
// MultiType<Type>::~MultiType()
// {
// }

template <typename Type>
Type MultiType<Type>::operator()()
{
  return this->value;
}

template <typename Type>
Type MultiType<Type>::operator()(Type val)
{
  this->value = val;
  return this->value;
}

// template <typename Type>
// string MultiType<Type>::getType()
// {
//   return string(typeid(Type).name());
// }

template <typename Type>
int MultiType<Type>::getInt() const
{
  if constexpr (std::is_same_v<Type, int> || std::is_same_v<Type, double>)
  {
    return static_cast<int>(value);
  }

  return 0;
}

template <typename Type>
double MultiType<Type>::getDouble() const
{
  if constexpr (std::is_same_v<Type, int> || std::is_same_v<Type, double>)
  {
    return static_cast<double>(value);
  }
  return 0.0;
}

template <typename Type>
std::string MultiType<Type>::getString() const
{
  if constexpr (std::is_same_v<Type, int> || std::is_same_v<Type, double>)
  {
    return std::to_string(value);
  }
  else if constexpr (std::is_same_v<Type, std::string>)
  {
    return value;
  }

  return "";
}

template <typename Type>
bool MultiType<Type>::isInt() const
{
  return std::is_same_v<Type, int>;
}

template <typename Type>
bool MultiType<Type>::isDouble() const
{
  return std::is_same_v<Type, double>;
}

template <typename Type>
bool MultiType<Type>::isNumeric() const
{
  return isInt() || isDouble();
}

template <typename Type>
bool MultiType<Type>::isString() const
{
  return std::is_same_v<Type, std::string>;
}

template class MultiType<int>;
template class MultiType<double>;
template class MultiType<std::string>;
