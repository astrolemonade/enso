@echo off
set comp-dir=%~dp0\..\component
set JAVA_OPTS=%JAVA_OPTS% --add-opens=java.base/java.nio=ALL-UNNAMED
java --module-path %comp-dir% -Dpolyglot.compiler.IterativePartialEscape=true %JAVA_OPTS% -m org.enso.runtime/org.enso.EngineRunnerBootLoader %*
exit /B %errorlevel%
