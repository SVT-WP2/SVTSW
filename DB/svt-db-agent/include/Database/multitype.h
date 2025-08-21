#ifndef _MULTIBASE_
#define _MULTIBASE_

#include <string>

class MultiBase
{
 public:
  virtual int getInt() = 0;
  virtual double getDouble() = 0;
  virtual std::string getString() = 0;

  virtual bool isInt() = 0;
  virtual bool isDouble() = 0;
  virtual bool isNumeric() = 0;
  virtual bool isString() = 0;

  virtual ~MultiBase() = default;

};

template <typename Type>
class MultiType : public MultiBase
{
 private:
  Type value;

 public:
  MultiType() = default;
  MultiType(Type val);
  ~MultiType() = default;

  Type operator()();
  Type operator()(Type val);

  int getInt();
  double getDouble();
  std::string getString();

  bool isInt();
  bool isDouble();
  bool isNumeric();
  bool isString();
};

#endif  // !_MULTIBASE_
