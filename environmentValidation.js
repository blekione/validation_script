#!/usr/bin/env jjs
//
// The script check system environment properties against DIffusion requirements.
//
// The script uses jjs command line tool which is a part of the Nashorn JavaScript
// engine which is a part of the Java 8.
// (https://docs.oracle.com/javase/8/docs/technotes/guides/scripting/nashorn/toc.html)
// To run script from Linux OS:
//    chmod u+x environmentValidation.js
//    ./environmentValidation.js
//
// To run script from Windows OS:
//    jjs environmentValidation.js
///////////////////////////////////////////////////////////////////////////////////////

var Files = java.nio.file.Files;
var status = "[GREEN]";
var propertiesFile = "validation.properties";
var red = '\033[0;31m';
var green = '\033[0;32m';
var amber = '\033[0;33m';
var nc = '\033[0m';
var descriptions = readDescriptions();

print("Environment properties check script");
createReportFile(propertiesFile);

var os = java.lang.System.getProperty("os.name");
print("OS is " + os + ".\n");

// Run platform checks
if (os === "Linux") {
    checkLinux(descriptions.linux);
    checkJavaVersion("sh -c", descriptions.javaCheck);
}
else if (os === "Mac OS X") {
    print("Purpose of this script is to validate production environment in which Diffusion " +
     "server will be running. Diffusion is not supported on Mac OS X." +
     " For more information check " +
     "https://docs.pushtechnology.com/docs/latest/manual/html/administratorguide/installation/system_requirements.html");
}
else {
    checkWindows(descriptions.windows);
    checkJavaVersion("cmd /C", descriptions.javaCheck);
}

print("\nOverall checks status: " + status);
///////////////////////////////////////////////////////////////////////////////////////

function createReportFile(fileName) {
    print("Validation results are saved in [" + fileName + "] file.");

    var FileSystems = java.nio.file.FileSystems;
    var REPLACE_EXISTING = java.nio.file.StandardCopyOption.REPLACE_EXISTING;
    var fs = FileSystems.getDefault();
    var path = fs.getPath(".", fileName);

    if (Files.exists(path)) {
        Files.move(path, fs.getPath(".", fileName + ".bak"), REPLACE_EXISTING);
    }
}

function readDescriptions() {
    var Paths = java.nio.file.Paths;
    var lines = Files.readAllLines(
            Paths.get("./descriptions.json"),
            java.nio.charset.StandardCharsets.UTF_8);
    var data = "";
    lines.forEach(function(line) { data += line; });
    return JSON.parse(data);
}

function checkLinux(linux) {
    var shell = "sh -c ";

    print("Test kernel version:");
    var checkStatus = "[GREEN]";
    checkStatus = doCheck(shell, [linux.kernelVersion], []);
    status = updateStatus(status, checkStatus);

    print("\n----------------------------------");
    print("Test required software for Linux OS:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    var properties = [linux.software.perf, linux.software.lsof, linux.software.sysstat];
    var failures = [];

    var testMessage = "system time synchronisation is present.";
    if (checkProperty(shell, linux.software.ntpdInstalled, false)) {
        saveCheckInFile(linux.software.ntpdInstalled, "[GREEN]", true);
        if (checkProperty(shell, linux.software.ntpdRunning, false)) {
            printTestResult(testMessage, "[GREEN]");
            saveCheckInFile(linux.software.ntpdRunning, "[GREEN]", true);
        }
        else {
            printTestResult(linux.software.ntpdRunning[1], linux.software.ntpdRunning[5]);
            saveCheckInFile(linux.software.ntpdRunning, linux.software.ntpdRunning[5], false);
            failures.push(linux.ntpdRunning);
        }
    }
    else if (checkProperty(shell, linux.software.chronydInstalled, false)) {
        saveCheckInFile(linux.software.chronydInstalled, "[GREEN]", true);
        if (checkProperty(shell, linux.software.chronydRunning, false)) {
            printTestResult(testMessage, "[GREEN]");
            saveCheckInFile(linux.software.chronydRunning, "[GREEN]", true);
        }
        else {
            printTestResult(linux.software.chronydRunning[1], linux.software.chronydRunning[5]);
            saveCheckInFile(linux.software.chronydRunning, linux.software.chronydRunning[5], false);
            failures.push(linux.software.chronydRunning);
        }
    }
    else {
        printTestResult(testMessage + " " + linux.software.chronydInstalled[1], linux.software.chronydInstalled[5]);
        saveCheckInFile(linux.software.chronydInstalled, linux.software.chronydInstalled[5], false);
        failures.push(linux.software.chronydInstalled);
    }

    checkStatus = doCheck(shell, properties, failures);
    status = updateStatus(status, checkStatus);
    print("----------------------------------");
    print("Test required software finished. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");

    print("\n----------------------------------");
    print("Test Linux OS memory settings:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    properties = getProperties(linux.memory);
    checkStatus = doCheck(shell, properties, []);
    status = updateStatus(status, checkStatus);
    print("----------------------------------");
    print("Test Linux OS memory settings finished. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");

    print("\n----------------------------------");
    print("Test Linux OS file system settings:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    properties = getProperties(linux.file_system);
    checkStatus = doCheck(shell, properties, []);
    status = updateStatus(status, checkStatus);
    print("----------------------------------");
    print("Test Linux OS file system settings finished. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");

    print("\n----------------------------------");
    print("Test Linux OS networking settings:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    properties = getProperties(linux.network);
    var initialFailures = [];
    if (!checkTcpMem(shell, linux.netIpv4TcpMem)) {
        checkStatus = linux.netIpv4TcpMem[5];
        initialFailures.push(linux.netIpv4TcpMem);
        print(linux.netIpv4TcpMem[1]);
    }
    checkStatus = doCheck(shell, properties, initialFailures);
    status = updateStatus(status, checkStatus);
    print("----------------------------------");
    print("Test Linux OS networking settings. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");
}

function checkWindows(){
    var shell = "cmd /C ";
}

function checkJavaVersion(shell, javaDesc) {
    print("\n----------------------------------");
    print("Test Java installation :");
    print("----------------------------------");
    var version = java.lang.System.getProperty("java.version");
    version = version.split("_");
    if (!checkValue(javaDesc.javaVersionMajor, version[0], false) ||
            !checkValue(javaDesc.javaVersionMinor, version[1], false) ||
            !checkValue(javaDesc.jvmVendor, java.lang.System.getProperty("java.vendor.url"), false) ||
            !checkProperty(shell, javaDesc.jdkInstalled, false)) {
        printTestResult("installed JVM is supported.","[RED]");
        print("----------------------------------");
        print(javaDesc.javaVersionMajor[1]);
    }
    else {
        printTestResult("installed JVM is supported.", "[GREEN]");
        print("----------------------------------");
    }
}

function writeFile(theData) {
    var FileWriter = java.io.FileWriter;
    var fileWriter = new FileWriter(propertiesFile, true);
    fileWriter.write(theData);
    fileWriter.write("\n");
    fileWriter.close();
}

function getProperties(parent) {
    var properties = [];
    for (var childIndex in parent) {
        if (parent.hasOwnProperty(childIndex)) {
            properties.push(parent[childIndex]);
        }
    }
    return properties;
}

function doCheck(shell, properties, initialFailures) {
    var checkStatus = "[GREEN]";
    var failures = doPropertiesChecks(shell,properties);
    failures = initialFailures.concat(failures);
    failures.forEach(function(failure) {
        checkStatus = updateStatus(checkStatus, failure[5]);
    });
    return checkStatus;
}

function doPropertiesChecks(shell, checks) {
    var failures = [];
    checks.forEach(function(check) {
        if (!checkProperty(shell, check, true)) {
            failures.push(check);
        }});
    return failures;
}

function getCheckResult(shell, check) {
    var command = shell + "\"" + check[2] + "\"";
    var result = `${command}`.trim();
    return result;
}

function checkProperty(shell, check, isResultPrintable) {
    var result = getCheckResult(shell, check);
    if (result !== null && !result.equals("")) {
        var resultFirstLine = result.match(/[^\r\n]+/g).shift(); // Removes empty lines from result
        return checkValue(check, resultFirstLine, isResultPrintable);
    }
    else if (isResultPrintable) {
           printTestResult(check[0], check[5]);
        return false;
    }
    return false;
}

function checkValue(check, result, isResultPrintable) {
    var property = check[0];
    var operator = check[3];
    var expectedValue = check[4];
    var ragStatus = check[5];
    var checkPass = false;

    if (operator == "===" && result === expectedValue) {
        checkPass = true;
    }
    else if (operator == ">" && result > expectedValue) {
        checkPass = true;
    }
    else if (operator == "<" && result < expectedValue) {
        checkPass = true;
    }
    else if (operator == "!=" && result != expectedValue) {
        checkPass = true;
    }
    else if (operator == "contains" && result.contains(expectedValue)) {
        checkPass = true;
        result = true;
    } 
    else if (operator != "===" && operator != ">" && operator != "<" &&
            operator != "contains" && operator != "!=") {
        print("ERROR!: unknown operator [" + operator + "].");
        return;
    }
    
    if (isResultPrintable) {
        if (checkPass) {
            ragStatus = "[GREEN]";
            printTestResult(property, ragStatus);
        }
        else {
            printTestResult(property + " " + check[1], ragStatus);
        }
    }
    saveCheckInFile(check, ragStatus, result);

    return checkPass;
}

function updateStatus(initStatus, newStatus) {
    if ("[RED]" !== initStatus && "[RED]" === newStatus) {
        return "[RED]";
    }
    else if ("[RED]" !== initStatus && "[AMBER]" === newStatus) {
        return "[AMBER]";
    }
    return initStatus;
}

function checkTcpMem(shell, check) {
    var maxConnections = check[4];

    var expectedValues = [
        (maxConnections * 0.4) | 0, // '| 0' "casts" double to int
        (maxConnections * 1.05) | 0,
        (maxConnections * 1.6) | 0];
    var result = getCheckResult(shell, check);
    var results = result.split("\t");
    
    for (var i = 0; i < results.length; i++) {
        if (results[i] !== expectedValues[i]) {
            printTestResult(check[0],check[5]);
            saveCheckInFile(check, check[5], result);
            return false;
        }
    }
    saveCheckInFile(check, "[GREEN]", result);
    return true;
}

function printTestResult(test, ragStatus) {
    print(getRagColour(ragStatus, ragStatus) + " " + test);
}

function getRagColour(ragStatus, message) {
    if (ragStatus === "[GREEN]") {
        return green + message + nc;
    } 
    else if (ragStatus === "[AMBER]") {
        return amber + message + nc;
    }
    else if (ragStatus === "[RED]") {
        return red + message + nc;
    }
    else {
        return message;
    }
}

function saveCheckInFile(check,ragStatus, result) {
    writeFile(check[6] + "_status = " + ragStatus);
    writeFile(check[6] + " = " + result);
}