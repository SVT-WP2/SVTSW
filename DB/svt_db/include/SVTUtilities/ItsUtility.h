#ifndef ITSUTILITY_H
#define ITSUTILITY_H

#include <vector>
#include <string>


class ItsUtility
{
public:
    ItsUtility();
    ~ItsUtility();

    static void removeWhiteSpaces(std::string& text);
    static void removeComments(std::string& text);

private:
    
};

#endif
