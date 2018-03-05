#!/usr/bin/env jjs
//
// The script check system environment properties against Diffusion requirements.
//
// The script uses jjs command line tool which is a part of the Nashorn JavaScript
// engine which is a part of Java 8.
// (https://docs.oracle.com/javase/8/docs/technotes/guides/scripting/nashorn/toc.html)
// To run script from Linux OS:
//    chmod u+x environmentValidation.js
//    ./environmentValidation.js
//
// To run script from Windows OS:
//    jjs environmentValidation.js
///////////////////////////////////////////////////////////////////////////////////////

var Files = java.nio.file.Files;
var overallStatus = "[GREEN]";
var propertiesFile = "validation.properties";
var descriptions = readDescriptions();

print("Environment properties check script");
createReportFile(propertiesFile);

var os = java.lang.System.getProperty("os.name");
print("OS is " + os + ".\n");

// Run platform checks
if (os === "Linux") {
    var red = '\033[0;31m';
    var green = '\033[0;32m';
    var amber = '\033[0;33m';
    var nc = '\033[0m';
    checkLinux(descriptions.linux);
    checkJavaVersion("sh -c", descriptions.javaCheck);
    print("\nOverall checks status: " + getRagColour(overallStatus, overallStatus));
}
else if (os === "Mac OS X") {
    print("Purpose of this script is to validate production environment in which Diffusion " +
     "server will be running. Mac OS X is not certified as a production system for Diffusion." +
     " For more information check " +
     "https://docs.pushtechnology.com/docs/latest/manual/html/administratorguide/installation/system_requirements.html");
}
else {
    var red = '';
    var green = '';
    var amber = '';
    var nc = '';
    checkWindows(descriptions.windows);
    checkJavaVersion("cmd /C", descriptions.javaCheck);
    print("\nOverall checks status: " + overallStatus);
}

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
    overallStatus = updateStatus(overallStatus, checkStatus);

    print("\n----------------------------------");
    print("Test for software required in Linux OS:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    var properties = [linux.software.perf, linux.software.lsof, linux.software.sysstat];
    var failures = [];

    var testMessage = "system time synchronisation installed and running [expected] / [result]: [true] / [false].\n";
    if (checkProperty(shell, linux.software.ntpdInstalled, false)) {
        saveCheckInFile(linux.software.ntpdInstalled, "[GREEN]", true);
        var ntpdRunning = linux.software.ntpdRunning;
        if (checkProperty(shell, ntpdRunning, true)) {
            // printTestResult(testMessage, "[GREEN]");
            saveCheckInFile(ntpdRunning, "[GREEN]", true);
        }
        else {
            // printTestResult(ntpdRunning.name, ntpdRunning.ragStatus);
            saveCheckInFile(ntpdRunning, ntpdRunning.ragStatus, false);
            failures.push(ntpdRunning);
        }
    }
    else if (checkProperty(shell, linux.software.chronydInstalled, false)) {
        saveCheckInFile(linux.software.chronydInstalled, "[GREEN]", true);
        var chronydRunning = linux.software.chronydRunning;
        if (checkProperty(shell, chronydRunning, true)) {
            // printTestResult(testMessage, "[GREEN]");
            saveCheckInFile(chronydRunning, "[GREEN]", true);
        }
        else {
            // printTestResult(chronydRunning.name, chronydRunning.ragStatus);
            saveCheckInFile(chronydRunning, chronydRunning.ragStatus, false);
            failures.push(chronydRunning);
        }
    }
    else {
        printTestResult(testMessage + linux.software.chronydInstalled.description, linux.software.chronydInstalled.ragStatus);
        saveCheckInFile(linux.software.chronydInstalled, linux.software.chronydInstalled.ragStatus, false);
        failures.push(linux.software.chronydInstalled);
    }

    checkStatus = doCheck(shell, properties, failures);
    overallStatus = updateStatus(overallStatus, checkStatus);
    print("----------------------------------");
    print("Test for software required finished. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");

    print("\n----------------------------------");
    print("Test Linux OS memory settings:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    properties = getProperties(linux.memory);
    checkStatus = doCheck(shell, properties, []);
    overallStatus = updateStatus(overallStatus, checkStatus);
    print("----------------------------------");
    print("Test Linux OS memory settings finished. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");

    print("\n----------------------------------");
    print("Test Linux OS file system settings:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    properties = getProperties(linux.file_system);
    checkStatus = doCheck(shell, properties, []);
    overallStatus = updateStatus(overallStatus, checkStatus);
    print("----------------------------------");
    print("Test Linux OS file system settings finished. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");

    print("\n----------------------------------");
    print("Test Linux OS networking settings:");
    print("----------------------------------");
    checkStatus = "[GREEN]";
    properties = getProperties(linux.network);
    var initialFailures = [];
    
    var maxConnections = linux.netIpv4TcpMem.expected;
    var expectedValues = [
        (maxConnections * 0.4) | 0, // '| 0' "casts" double to int
        (maxConnections * 1.05) | 0,
        (maxConnections * 1.6) | 0];
    if (!checkMultipleValuesSetting(shell, linux.netIpv4TcpMem, expectedValues)) {
        initialFailures.push(linux.netIpv4TcpMem);
    }

    expectedValues = linux.netIpv4TcpRmem.expected.split(" ");
    if (!checkMultipleValuesSetting(shell, linux.netIpv4TcpRmem, expectedValues)) {
        initialFailures.push(linux.netIpv4TcpRmem);
    }

    expectedValues = linux.netIpv4TcpWmem.expected.split(" ");
    if (!checkMultipleValuesSetting(shell, linux.netIpv4TcpWmem, expectedValues)) {
        initialFailures.push(linux.netIpv4TcpWmem);
    }

    checkStatus = doCheck(shell, properties, initialFailures);
    overallStatus = updateStatus(overallStatus, checkStatus);
    print("----------------------------------");
    print("Test Linux OS networking settings. Status " + getRagColour(checkStatus, checkStatus));
    print("----------------------------------");
}

function checkWindows() {
    var shell = "cmd /C ";
}

function checkJavaVersion(shell, javaDesc) {
    print("\n----------------------------------");
    print("Test Java installation :");
    print("----------------------------------");
    var version = java.lang.System.getProperty("java.version").split(/[\s_-]+/);
    if (!checkValue(javaDesc.javaVersionMajor, version[0], false) ||
            !checkValue(javaDesc.javaVersionMinor, version[1], false) ||
            !checkValue(javaDesc.jvmVendor, java.lang.System.getProperty("java.vendor.url"), false) ||
            !checkProperty(shell, javaDesc.jdkInstalled, false)) {
        printTestResult("installed JVM is supported.","[RED]");
        print("----------------------------------");
        print(javaDesc.javaVersionMajor.description);
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
    var failures = doPropertiesChecks(shell, properties);
    failures = initialFailures.concat(failures);
    failures.forEach(function(failure) {
        checkStatus = updateStatus(checkStatus, failure.ragStatus);
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

function getCheckResult(shell, shellCommand) {
    var command = shell + "\"" + shellCommand + "\"";
    var result = `${command}`.trim();
    // print ("result: " + result);
    return result;
}

function checkProperty(shell, check, isResultPrintable) {
    var result = getCheckResult(shell, check.command);
    if (result !== null && !result.equals("")) {
        var resultFirstLine = result.match(/[^\r\n]+/g).shift(); // Removes empty lines from result
        return checkValue(check, resultFirstLine, isResultPrintable);
    }
    else if (isResultPrintable) {
           printTestResult(check.name + " [expected]: [" + check.expected + "], but check returns NULL or empty value.", check.ragStatus);
           saveCheckInFile(check, check.ragStatus, "NULL");
        return false;
    }
    return false;
}

function checkValue(check, result, isResultPrintable) {
    var ragStatus = check.ragStatus;

    var checkPass = evaluate(result, check);
    if (isResultPrintable) {
        if (checkPass) {
            printTestResult(check.name + " [result]: [" + result + "].", "[GREEN]");
        }
        else {
            printTestResult(check.name + " [expected] / [result]: [" + check.expected + "] / [" + result + "].\n" + check.description, ragStatus);
        }
    }

    saveCheckInFile(check, ragStatus, result);
    return checkPass;
}

function evaluate(result, check) {
    if (check.operant == "contains") {
        return eval("\"" + result + "\".contains(\"" + check.expected + "\") ? true : false;");
    }
    else {
        return eval(result + check.operant + check.expected + " ? true : false;");
    }
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

function checkMultipleValuesSetting(shell, check, expectedValues) {
    var result = getCheckResult(shell, check.command);
    var results = result.split("\t");
    for (var i = 0; i < results.length; i++) {
        if (results[i] != expectedValues[i]) {
            printTestResult(check.name + " [expected] / [result]: ["+ expectedValues[i] + "] / [" + results[i] + "].\n" + check.description, check.ragStatus);
            saveCheckInFile(check, check.ragStatus, result);
            return false;
        }
    }

    printTestResult(check.name, "[GREEN]");
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

function saveCheckInFile(check, ragStatus, result) {
    writeFile(check.savedAs + "_status = " + ragStatus);
    writeFile(check.savedAs + " = " + result);
}