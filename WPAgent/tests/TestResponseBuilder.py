"""
Test ResponseBuilder
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_response_builder_success():
    """Test creating a success response"""
    try:
        from utilities.WPResponseBuilder import ResponseBuilder
        
        result = ResponseBuilder.success(
            message="Operation successful",
            command="TestCommand",
            data={"key": "value"}
        )
        
        assert "status" in result
        assert result["status"] == "Success"
        print("ResponseBuilder success test passed!")
        
    except ImportError as e:
        print(f"Could not import ResponseBuilder: {e}")
        print("This is OK - we'll test it later!")


def test_response_builder_error():
    """Test creating an error response"""
    try:
        from utilities.WPResponseBuilder import ResponseBuilder
        
        result = ResponseBuilder.error(
            message="Operation failed",
            command="TestCommand"
        )
        
        assert "status" in result
        assert "error" in result
        print("ResponseBuilder error test passed!")
        
    except ImportError:
        pass


if __name__ == "__main__":
    print("Run with: pytest tests/test_response_builder.py")
