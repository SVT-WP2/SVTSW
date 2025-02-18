#include "Database/multitype.h"
#include <typeinfo>

// typeid(..).name() is not portable between compilers!
static const char *MULTITYPE_INTEGER = typeid(int).name();
static const char *MULTITYPE_DOUBLE = typeid(double).name();
static const char *MULTITYPE_STRING = typeid(string).name();

// MultiBase::~MultiBase() {}

MultiBase::MultiWrapper::MultiWrapper(int value) { this->intVal = value; }

MultiBase::MultiWrapper::MultiWrapper(double value) { this->doubleVal = value; }

MultiBase::MultiWrapper::MultiWrapper(string value) { this->stringVal = value; }

int MultiBase::MultiWrapper::getInt() { return this->intVal; }

double MultiBase::MultiWrapper::getDouble() { return this->doubleVal; }

string MultiBase::MultiWrapper::getString() { return this->stringVal; }

// template <typename Type>
// MultiType<Type>::MultiType()
// {
// }

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

template <typename Type>
string MultiType<Type>::getType()
{
  return string(typeid(Type).name());
}

template <typename Type>
int MultiType<Type>::getInt()
{
  MultiWrapper wrapper(this->value);

  if (getType() == MULTITYPE_INTEGER)
  {
    return wrapper.getInt();
  }
  else if (getType() == MULTITYPE_DOUBLE)
  {
    return int(wrapper.getDouble());
  }

  return 0;
}

template <typename Type>
double MultiType<Type>::getDouble()
{
  MultiWrapper wrapper(this->value);

  if (getType() == MULTITYPE_DOUBLE)
  {
    return wrapper.getDouble();
  }
  else if (getType() == MULTITYPE_INTEGER)
  {
    return double(wrapper.getInt());
  }

  return 0.0;
}

template <typename Type>
string MultiType<Type>::getString()
{
  MultiWrapper wrapper(this->value);

  if (getType() == MULTITYPE_INTEGER)
  {
    return to_string(wrapper.getInt());
  }
  else if (getType() == MULTITYPE_DOUBLE)
  {
    return to_string(wrapper.getDouble());
  }

  return wrapper.getString();
}

template <typename Type>
bool MultiType<Type>::isInt()
{
  return getType() == MULTITYPE_INTEGER;
}

template <typename Type>
bool MultiType<Type>::isDouble()
{
  return getType() == MULTITYPE_DOUBLE;
}

template <typename Type>
bool MultiType<Type>::isNumeric()
{
  return isInt() || isDouble();
}

template <typename Type>
bool MultiType<Type>::isString()
{
  return getType() == MULTITYPE_STRING;
}

template class MultiType<int>;
template class MultiType<double>;
template class MultiType<string>;
