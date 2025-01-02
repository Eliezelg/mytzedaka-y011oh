package com.ijap.app

import org.junit.Test // junit:junit:4.13.2
import org.junit.Assert.* // junit:junit:4.13.2

/**
 * Example unit test class demonstrating basic test setup and patterns for Android unit testing.
 * This class serves as a template for other test classes in the project, showing proper:
 * - Test class structure
 * - Method naming conventions
 * - Assertion usage
 * - Documentation standards
 */
class ExampleUnitTest {

    /**
     * Example test method demonstrating basic arithmetic test pattern.
     * Shows proper test method structure, assertion usage, and naming conventions.
     * 
     * Test naming pattern: methodName_testCondition_expectedResult
     */
    @Test
    fun addition_isCorrect() {
        // Arrange - Define expected result
        val expected = 4

        // Act - Perform the operation being tested
        val actual = 2 + 2

        // Assert - Verify the result matches expectations
        assertEquals("Basic arithmetic addition should compute correctly", expected, actual)
    }
}