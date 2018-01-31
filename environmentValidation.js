#!/usr/bin/env jjs
#
# The script check system environment properties against DIffusion requirements.
#
# The script uses jjs command line tool which is a part of the Nashorn JavaScript
# engine which is a part of the Java 8.
# (https://docs.oracle.com/javase/8/docs/technotes/guides/scripting/nashorn/toc.html)
#
# To run script from Linux OS:
#    chmod u+x environmentValidation.js
#    ./environmentValidation.js
#
# To run script from Windows OS:
#    jjs environmentValidation.js
################################################################################

var Files = java.nio.file.Files;
var status = "pass";
var shell = "";
var propertiesFile = "validation.properties";

print("Environment properties check script");
createReportFile(propertiesFile);

var descriptions = readDescriptions();

var os = java.lang.System.getProperty("os.name");
print("OS is " + os + ".\n");

//Run platform checks
if (os == "Linux") {
    checkLinux(descriptions.linux);
} 
else {
    checkWindows(descriptions.windows);
}

//checkJavaVersion(descriptions.java);

print("\nOverall checks status: " + status);
################################################################################

function createReportFile(fileName) {
    print("Validation resulta are saved in [" + fileName + "] file.");

    var FileSystems = java.nio.file.FileSystems;
    var FileSystem = java.nio.file.FileSystem;
    var REPLACE_EXISTING = java.nio.file.StandardCopyOption.REPLACE_EXISTING;
    var fs = FileSystems.getDefault();
    var path = fs.getPath(".", fileName);

    if (Files.exists(path)) {
        Files.move(path, fs.getPath(".", fileName +".bak"), REPLACE_EXISTING);
    }
}

function readDescriptions() {
    var Paths = java.nio.file.Paths;
    var lines = Files.readAllLines(Paths.get("./descriptions.json"), java.nio.charset.StandardCharsets.UTF_8);
    var data = "";
    lines.forEach(function(line) { data += line; });
    return JSON.parse(data);
}

function checkLinux(linux){
    shell = "sh -c ";
    var kernelVersion = checkProperty(shell, linux.kernelVersion);
    print("----------------------------------");
    print("Check required software for Linux OS:")
    var softwares = [linux.perf, linux.lsof, linux.sysstat];
    var failures = [];
    softwares.forEach(function(software) {
        if ("fail" === checkProperty(shell, software)) {
            failures.push(software);
        }});
//    checkProperty(shell, linux.lsof);
//    checkProperty(shell, linux.sysstat);

    if(checkProperty(shell, linux.ntpInstalled)) {
        if (checkProperty(shell, linux.ntpRunning)) {
            print("you are fine, take a beer and and enjoy.");
        }
        else {
            if (checkChrony(linux)) {
                print("you are fine, take a beer and enjoy.");
            }
            else {
                print("you are in trouble, ntp installed but not running")
            }
        }
    }
    else if (checkChrony(linux)) {
        print("you are fine, take a beer and and enjoy.");
    }
/*
    // Core ulimit needs to be set to "unlimited so that core files, used for debug purpose, are not truncated.
    checkProperty(linux.ulimitC, "ulimit -c", "===", "unlimited", "amber");
    checkProperty(linux.auditDisabled, "cat /proc/cmdline | grep -F audit=0| wc -l", "===", 0, "amber");
    checkProperty(linux.thpDisabled, "cat /sys/kernel/mm/transparent_hugepage/enabled | grep -F [never]| wc -l", ">", 0, "amber");
    // Checks max number of files which can be open per process soft and hard limit
    checkProperty(linux.openFilesSoftLimit, "prlimit -o RESOURCE,SOFT|grep NOFILE|awk '{print $NF}'", ">", 999998, "red");
    checkProperty(linux.openFilesHardLimit, "prlimit -o RESOURCE,HARD|grep NOFILE|awk '{print $NF}'", ">", 999998, "red");

    var sysctl = linux.sysctl;
    // Checks max number of files (file descriptors) which can be open in system (different than per user)
    checkSysctl(sysctl.fileDescriptors, ">", 999998, "red");
    // fs.nr_open max number of file descriptors (different than files) per process (default value is 1024*1024 (1048576)). 
    checkSysctl(sysctl.openFileDescriptorsPerProcess, ">", 999998, "red");

    checkSysctl(sysctl.dirtyRatio, ">", 89, "amber");
    checkSysctl(sysctl.swappiness, "===", 0, "amber");
    
    checkSysctl(sysctl.netCoreRmemMax, ">", 16777216, "amber");
    checkSysctl(sysctl.netCoreWmemMax, ">", 16777216, "amber");
    checkSysctl(sysctl.netCoreRmemDefault, ">", 16777216, "amber");
    checkSysctl(sysctl.netCoreWmemDefault, ">", 16777216, "amber");
    checkSysctl(sysctl.netCoreOptmemMax, ">", 16777216, "amber");
    checkSysctl(sysctl.netIpv4TcpRmem, "===", "4096 16384 16777216", "amber");
    checkSysctl(sysctl.netIpv4TcpWmem, "===", "4096 16384 16777216", "amber");
    checkSysctl(sysctl.netIpv4TCPMaxTWBuckets, ">", 1999999, "amber");
    checkSysctl(sysctl.netIpv4TcpFinTimeout, "===", "30", "amber");
    checkSysctl(sysctl.netIpv4TcpTWReuse, "===", "1", "amber");
    checkSysctl(sysctl.netCoreNetdevMaxBacklog, ">", 49999, "amber");
    checkSysctl(sysctl.netIpv4TcpMaxSynBacklog, ">", 49999, "amber");
    checkSysctl(sysctl.netIpv4TcpSlowStartAfterIdle, "===", "0", "red");
    checkTcpMem(sysctl);

    checkProperty(descriptions.hardware.freeMemory, "free -g|awk '/Mem:/{print $2}'", ">", 1, "red");
    */
}

function checkWindows(){
    shell = "cmd /C ";
}

function writeFile(theData) {
    var FileWriter = java.io.FileWriter;
    var fileWriter = new FileWriter(propertiesFile, true);
    fileWriter.write(theData);
    fileWriter.write("\n");
    fileWriter.close();
}

function checkProperty(shell, check) {
    var command = shell + "\"" + check[3] + "\"";
//    print(command);
    var result = `${command}`.trim();
//    print("result: " + result)
    
    if (result != null && !result.equals("")) {
        resultFirstLine = result.match(/[^\r\n]+/g).shift(); // Removes empty lines from result
        return checkValue(check, resultFirstLine);
    }
    else {
        print("Test: " +
                check[0] +
                ". Result: FAIL [expected but not present/installed].");
        return false;
    }
}

function checkValue(check, result) {
    var property = check[0]
    var operator = check[4];
    var expectedValue = check[5];
    var ragStatus = check[6];
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
    else if (operator == "contains" && result.contains(expectedValue)) {
        checkPass = true;
        result = true;
    } 
    else if (operator != "===" && operator != ">" && operator != "<" && operator != "contains") {
        print("ERROR!: unknown operator [" + operator + "].")
    }

    if (checkPass) {
        print("Test if " + property + ". Result: OK [" + result + "].");
        ragStatus = "green";
    }
//    else if (!checkPass && ragSeverity === "amber") {
//        print("lolo yolo");
//    }
    else {
        print("Test if " + property + ". Result: FAIL. Expected [" +
                operator + " " +expectedValue + "] but received [" + result + "].");
        status = "fail";
    }

    writeFile(property[0] + "_status = " + ragStatus);
    writeFile(property[0] + " = " + result);

    return checkPass;
}

function checkChrony(linux) {
    if (!checkProperty(shell, linux.chronyInstalled)) {
        return false;
    }
    else if (!checkProperty(shell, linux.chronyRunning)) {
        print("you are in trouble, chrony is installed but not running");
        return false;
    }
    else {
        return true;
    }
}

function checkSysctl(name, operator, expected, ragSeverity){
    print()
    checkProperty(
            name,
            "sysctl -n " + name[3] + " 2>/dev/null",
            operator,
            expected,
            ragSeverity);
}

function checkTcpMem(sysctl) {
    var maxConnections = 999999;
    var property = "net.ipv4.tcp_mem";
    var checkNames = ["low", "pressure", "high"];
    
    var expectedValues = [
        (maxConnections * 0.4) | 0, // '| 0' "casts" double to int
        (maxConnections * 1.05) | 0,
        (maxConnections * 1.6) | 0] 
    result = $EXEC(shell + " \" sysctl -n " + property + " \"").trim();
    results = result.split("\t");
    for (i=0; i < results.length; i++) {
        var property = [];
        property.push(checkNames[i]);
        checkValue(property,
                results[i], ">", expectedValues[i],
                "amber");
    }
}

function checkJavaVersion(javaDesc) {
    var version = java.lang.System.getProperty("java.version");
    version = version.split("_");
    checkValue(javaDesc.javaVersionMajor, version[0], "===", "1.8.0", "red");
    checkValue(javaDesc.javaVersionMinor, version[1], ">" , 64, "red");

    checkValue(javaDesc.jvmVendor, java.lang.System.getProperty("java.vendor.url"), "contains", "oracle", "red");
    checkProperty(javaDesc.jdkInstalled, "javac 2>&1", "contains", "Usage: javac", "red");
}
