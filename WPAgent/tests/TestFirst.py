"""
Your First Test!
Just to verify pytest works.
"""

def test_basic_math():
    """Test that basic math works (sanity check)"""
    assert 1 + 1 == 2
    assert 2 * 3 == 6


def test_response_structure():
    """Test a typical WPAgent response structure"""
    response = {
        "status": "Success",
        "type": "TestReply",
        "data": {"message": "Test passed!"}
    }
    
    assert "status" in response
    assert response["status"] == "Success"
    assert "data" in response


if __name__ == "__main__":
    print("Run with: pytest tests/test_first.py")
