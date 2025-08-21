#ifndef _MULTIBASE_
#define _MULTIBASE_

#include <string>

class MultiBase
{
 public:
  virtual int getInt() const = 0;
  virtual double getDouble() const = 0;
  virtual std::string getString() const = 0;

  virtual bool isInt() const = 0;
  virtual bool isDouble() const = 0;
  virtual bool isNumeric() const = 0;
  virtual bool isString() const = 0;

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

  int getInt() const override;
  double getDouble() const override;
  std::string getString() const override;

  bool isInt() const override;
  bool isDouble() const override;
  bool isNumeric() const override;
  bool isString() const override;
};

#endif  // !_MULTIBASE_
