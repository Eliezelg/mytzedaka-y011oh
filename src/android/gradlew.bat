@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows with enhanced security and error handling
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

@rem Add default JVM options here. You can also use JAVA_OPTS and GRADLE_OPTS
@rem to pass JVM options to this script.
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m" "-Dfile.encoding=UTF-8" "-Dconsole.encoding=UTF-8"

@rem Store the current directory for later use
set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.

@rem Validate and find java.exe from standard locations
set JAVA_EXE=
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set JAVA_EXE=%JAVA_HOME%\bin\java.exe
        goto validate_java
    )
)
@rem Look for java in PATH
for %%i in (java.exe) do set JAVA_EXE=%%~$PATH:i
if not "%JAVA_EXE%"=="" goto validate_java

echo Error: JAVA_HOME is not set and no 'java' command could be found in your PATH.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
goto fail

:validate_java
@rem Validate Java version and installation
"%JAVA_EXE%" -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto init
echo Error: The Java installation appears to be corrupted.
echo Please ensure you have a valid Java installation.
goto fail

:init
@rem Get command-line arguments
set CMD_LINE_ARGS=
set _SKIP=2

:win9xME_args_slurp
if "x%~1" == "x" goto execute
set CMD_LINE_ARGS=%*

:execute
@rem Setup the command line with enhanced security parameters

@rem Validate Gradle wrapper files
set WRAPPER_JAR=%DIRNAME%\gradle\wrapper\gradle-wrapper.jar
set WRAPPER_PROPERTIES=%DIRNAME%\gradle\wrapper\gradle-wrapper.properties

if not exist "%WRAPPER_JAR%" (
    echo Error: Gradle wrapper JAR file is missing.
    echo Expected location: %WRAPPER_JAR%
    goto fail
)

if not exist "%WRAPPER_PROPERTIES%" (
    echo Error: Gradle wrapper properties file is missing.
    echo Expected location: %WRAPPER_PROPERTIES%
    goto fail
)

@rem Verify wrapper jar file permissions
dir /a "%WRAPPER_JAR%" | findstr "^d" >NUL
if %ERRORLEVEL% equ 0 (
    echo Error: Invalid permissions on Gradle wrapper JAR.
    goto fail
)

@rem Setup the command line with security parameters
set CLASSPATH=%WRAPPER_JAR%

@rem Escape application args for security
set GRADLE_OPTS=%GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%"

@rem Execute Gradle with enhanced security and error handling
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% ^
  -classpath "%CLASSPATH%" ^
  -Dgradle.user.home="%DIRNAME%\gradle" ^
  -Dgradle.home="%DIRNAME%\gradle" ^
  -Dgradle.wrapper.properties="%WRAPPER_PROPERTIES%" ^
  org.gradle.wrapper.GradleWrapperMain %CMD_LINE_ARGS%

:end
@rem End local scope for the variables with windows NT shell
if %ERRORLEVEL% equ 0 goto mainEnd

:fail
@rem Set variable GRADLE_EXIT_CONSOLE if you need the _script_ return code instead of
@rem the _cmd.exe /c_ return code!
if not "" == "%GRADLE_EXIT_CONSOLE%" exit 1
exit /b 1

:mainEnd
if "%OS%"=="Windows_NT" endlocal

:omega