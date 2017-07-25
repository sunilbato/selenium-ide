var userWinID = 0;
var mySideexTabID = 0;
var windowIdArray = {};
var playingTabIds = {};
var playingTabNames = {};
var currentPlayingFrameLocation = "root";
var currentPlayingCommandIndex = -1;

var currentTestCaseId = "";
var isPause = false;
var pauseValue = null;
var isPlayingSuite = false;

var commandType = "";
var pageCount = 0;
var pageTime = "";
var ajaxCount = 0;
var ajaxTime = "";
var domCount = 0;
var domTime = "";
var implicitCount = 0;
var implicitTime = "";

var caseFailed = false;

window.onload = function() {
    var playButton = document.getElementById("playback");
    var pauseButton = document.getElementById("pause");
    var resumeButton = document.getElementById("resume");
    var playSuiteButton = document.getElementById("playSuite");
    var playSuitesButton = document.getElementById("playSuites");
    /*var recordButton = document.getElementById("record");*/
    //element.addEventListener("click",play);
    playButton.addEventListener("click", function() {
        document.getElementById("result-runs").innerHTML = "0";
        document.getElementById("result-failures").innerHTML = "0";
        initAllSuite();
        play();
    });
    pauseButton.addEventListener("click", pause);
    pauseButton.disabled = true;
    resumeButton.addEventListener("click", resume);
    playSuiteButton.addEventListener("click", function() {
        document.getElementById("result-runs").innerHTML = "0";
        document.getElementById("result-failures").innerHTML = "0";
        initAllSuite();
        playSuite(0);
    });
    playSuitesButton.addEventListener("click", function() {
        document.getElementById("result-runs").innerHTML = "0";
        document.getElementById("result-failures").innerHTML = "0";
        initAllSuite();
        playSuites(0);
    });
    /*recordButton.addEventListener("click", startRecord);*/
    //console.error(recordButton);
};

function disableClick() {
    document.getElementById("pause").disabled = false;
    document.getElementById('testCase-grid').style.pointerEvents = 'none';
    document.getElementById('command-container').style.pointerEvents = 'none';
}

function enableClick() {
    document.getElementById("pause").disabled = true;
    document.getElementById('testCase-grid').style.pointerEvents = 'auto';
    document.getElementById('command-container').style.pointerEvents = 'auto';
}

function play() {
    initializePlayingProgress()
        .then(executionLoop)
        .then(finalizePlayingProgress)
        .catch(catchPlayingError);
}

function playAfterConnectionFailed() {
    initializeAfterConnectionFailed()
        .then(executionLoop)
        .then(finalizePlayingProgress)
        .catch(catchPlayingError);
}

function initializeAfterConnectionFailed() {
    disableClick();

    isRecording = false;
    isPlaying = true;
    playingTabNames = new Object();
    playingTabIds = new Object();
    //windowIdArray = new Object();
    //windowIdArray[userWinID] = true;
    currentPlayingWindowId = userWinID;
    currentPlayingFrameLocation = "root";
    playingFrameLocations = {};

    commandType = "preparation";
    pageCount = ajaxCount = domCount = implicitCount = 0;
    pageTime = ajaxTime = domTime = implicitTime = "";

    caseFailed = false;

    currentTestCaseId = getSelectedCase().id;
    var commands = getRecordsArray();

    return browser.tabs.query({
            windowId: currentPlayingWindowId,
            active: true
        })
        .then(function(tabs) {
            if (tabs.length === 0) {
                throw new Error("Can't find the window");
                // ...Or we can create a new window for user
                // and binding to a new userWinId.
            }
            currentPlayingTabId = tabs[0].id;
            playingTabNames["win_ser_local"] = currentPlayingTabId;
            playingTabIds[currentPlayingTabId] = "win_ser_local";
            playingFrameLocations[currentPlayingTabId] = {};
            playingFrameLocations[currentPlayingTabId]["root"] = 0;
            /* we assume that there is no open command */
            /* select Frame directly will cause failed */
            playingFrameLocations[currentPlayingTabId]["status"] = true;
        })
}

function pause() {
    if (isPlaying) {
        isPause = true;
        switchPR();
    }
}

function resume() {
    if(currentTestCaseId!=getSelectedCase().id)
        setSelectedCase(currentTestCaseId);
    if (isPause) {
        isPlaying = true;
        isPause = false;
        switchPR();
        disableClick();
        executionLoop()
            .then(finalizePlayingProgress)
            .catch(catchPlayingError);
    }
}

function initAllSuite() {
    var suites = document.getElementById("testCase-grid").getElementsByClassName("message");
    var length = suites.length;
    for (var k = 0; k < suites.length; ++k) {
        var cases = suites[k].getElementsByTagName("p");
        for (var u = 0; u < cases.length; ++u) {
            $("#" + cases[u].id).removeClass('fail success');
        }
    }
}

function playSuite(i) {
    isPlayingSuite = true;
    var cases = getSelectedSuite().getElementsByTagName("p");
    var length = cases.length;
    if (i == 0) {
        sideex_log.info("Playing test suite " + sideex_testSuite[getSelectedSuite().id].title);
    }
    if (i < length) {
        setSelectedCase(cases[i].id);
        sideex_log.info("Playing test case " + sideex_testCase[cases[i].id].title);
        play();
        nextCase(i);
    } else {
        isPlayingSuite = false;
    }
}

function nextCase(i) {
    if (isPlaying || isPause) setTimeout(function() {
        nextCase(i);
    }, 500);
    else playSuite(i + 1);
}

function playSuites(i) {
    var suites = document.getElementById("testCase-grid").getElementsByClassName("message");
    var length = suites.length;

    if (i < length) {
        if (suites[i].id.includes("suite")) {
            setSelectedSuite(suites[i].id);
            playSuite(0);
        }
        console.log("call nextSuite");
        nextSuite(i);
    }
}

function nextSuite(i) {
    console.log(i);
    if (isPlayingSuite) setTimeout(function() {
        nextSuite(i);
    }, 2000);
    else playSuites(i + 1);
}

function executeCommand(index) {
    var id = parseInt(index) - 1;
    var commands = getRecordsArray();
    var commandName = getCommandName(commands[id]);
    var commandTarget = getCommandTarget(commands[id]);
    var commandValue = getCommandValue(commands[id]);

    sideex_log.info("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");

    initializePlayingProgress(true);

    setColor(id + 1, "executing");

    browser.tabs.query({
            windowId: userWinID,
            active: true
        })
        .then(function(tabs) {
            //commandReceiverTabId = tabs[0].id;
            console.log("send: " + tabs[0].id);
            return browser.tabs.sendMessage(tabs[0].id, {
                commands: commandName,
                target: commandTarget,
                value: commandValue,
                mySideexTabID: mySideexTabID
            }, {
                frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
            })
        })
        .then(function(result) {
            if (result.result != "success") {
                sideex_log.error(result.result);
                setColor(id + 1, "fail");
                if (!result.result.includes("did not match")) {
                    return true;
                }
            } else {
                setColor(id + 1, "success");
            }
        })

    finalizePlayingProgress();
}

/*
function send(cmdName, cmdTarget, cmdValue) {
    //console.error(cmdName+" "+cmdValue);
    browser.tabs.query({ url: "<all_urls>", active: true }, function(tabs) {
        console.log(tabs.length);
        //console.log(tabs[0].url);
        for (let tab of tabs) {
            browser.tabs.sendMessage(
                tab.id, { commands: cmdName, target: cmdTarget, value:cmdValue },
                onResponse
            ).catch(onError);
        }
    });
}
*/

function onError(error) {
    console.log("QAQ");
    alert(`Error: ${error}`);
}

/*
function onResponse(response) {
    window.alert(response.status);
};
*/

function cleanStatus() {
    var commands = getRecordsArray();
    for (var i = 0; i < commands.length; ++i) {
        commands[i].setAttribute("class", "");
    }
    classifyRecords(1, commands.length);
}

function initializePlayingProgress(isDbclick) {
    disableClick();

    isRecording = false;
    isPlaying = true;
    //var commands = getRecordsArray();
    playingTabNames = new Object();
    playingTabIds = new Object();
    //windowIdArray = new Object();
    //windowIdArray[userWinID] = true;
    currentPlayingWindowId = userWinID;
    currentPlayingFrameLocation = "root";
    playingFrameLocations = {};
    currentPlayingCommandIndex = -1;

    // xian wait
    commandType = "preparation";
    pageCount = ajaxCount = domCount = implicitCount = 0;
    pageTime = ajaxTime = domTime = implicitTime = "";

    caseFailed = false;

    currentTestCaseId = getSelectedCase().id;

    if (!isDbclick) {
        $("#" + currentTestCaseId).removeClass('fail success');
    }
    var commands = getRecordsArray();

    cleanStatus();

    return browser.tabs.query({
            windowId: currentPlayingWindowId,
            active: true
        })
        .then(function(tabs) {
            if (tabs.length === 0) {
                throw new Error("Can't find the window");
                // ...Or we can create a new window for user
                // and binding to a new userWinId.
            }
            currentPlayingTabId = tabs[0].id;
            playingTabNames["win_ser_local"] = currentPlayingTabId;
            playingTabIds[currentPlayingTabId] = "win_ser_local";
            playingFrameLocations[currentPlayingTabId] = {};
            playingFrameLocations[currentPlayingTabId]["root"] = 0;
            /* we assume that there is no open command */
            /* select Frame directly will cause failed */
            playingFrameLocations[currentPlayingTabId]["status"] = true;
        });
}

function executionLoop() {
    if (isPause) {
        return true;
    }

    if (commandType == "preparation") {
        console.log("in preparation");
        return browser.tabs.query({
                windowId: userWinID,
                active: true
            })
            .then(function(tabs) {
                return browser.tabs.sendMessage(tabs[0].id, {
                    commands: "waitPreparation",
                    target: "",
                    value: "",
                    mySideexTabID: mySideexTabID
                }, {
                    frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
                });
            })
            .then(function() {
                commandType = "prePageWait";
            })
            .then(executionLoop);
    } else if (commandType == "prePageWait") {
        console.log("in prePageWait");
        return browser.tabs.query({
                windowId: userWinID,
                active: true
            })
            .then(function(tabs) {
                return browser.tabs.sendMessage(tabs[0].id, {
                    commands: "prePageWait",
                    target: "",
                    value: "",
                    mySideexTabID: mySideexTabID
                }, {
                    frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
                });
            })
            .then(function(response) {
                if (response && response.new_page) {
                    console.log("prePageWaiting");
                    commandType = "prePageWait";
                } else {
                    commandType = "pageWait";
                }
            })
            .then(executionLoop);
    } else if (commandType == "pageWait") {
        console.log("in pageWait");
        return browser.tabs.query({
                windowId: userWinID,
                active: true
            })
            .then(function(tabs) {
                return browser.tabs.sendMessage(tabs[0].id, {
                    commands: "pageWait",
                    target: "",
                    value: "",
                    mySideexTabID: mySideexTabID
                }, {
                    frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
                })
            })
            .then(function(response) {
                if (pageTime && (Date.now() - pageTime) > 30000) {
                    sideex_log.error("Page Wait timed out after 30000ms");
                    pageCount = 0;
                    pageTime = "";
                    commandType = "ajaxWait";
                } else if (response && response.page_done) {
                    pageCount = 0;
                    pageTime = "";
                    commandType = "ajaxWait";
                } else {
                    pageCount++;
                    if (pageCount == 1) {
                        pageTime = Date.now();
                        sideex_log.info("Wait for the new page to be fully loaded");
                    }
                    commandType = "pageWait";
                }
            })
            .then(executionLoop);
    } else if (commandType == "ajaxWait") {
        console.log("in ajaxWait");
        return browser.tabs.query({
                windowId: userWinID,
                active: true
            })
            .then(function(tabs) {
                return browser.tabs.sendMessage(tabs[0].id, {
                    commands: "ajaxWait",
                    target: "",
                    value: "",
                    mySideexTabID: mySideexTabID
                }, {
                    frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
                })
            })
            .then(function(response) {
                if (ajaxTime && (Date.now() - ajaxTime) > 30000) {
                    sideex_log.error("Ajax Wait timed out after 30000ms");
                    ajaxCount = 0;
                    ajaxTime = "";
                    commandType = "domWait";
                } else if (response && response.ajax_done) {
                    ajaxCount = 0;
                    ajaxTime = "";
                    commandType = "domWait";
                } else {
                    ajaxCount++;
                    if (ajaxCount == 1) {
                        ajaxTime = Date.now();
                        sideex_log.info("Wait for all ajax requests to be done");
                    }
                    commandType = "ajaxWait";
                }
            })
            .then(executionLoop);
    } else if (commandType == "domWait") {
        console.log("in domWait");
        return browser.tabs.query({
                windowId: userWinID,
                active: true
            })
            .then(function(tabs) {
                return browser.tabs.sendMessage(tabs[0].id, {
                    commands: "domWait",
                    target: "",
                    value: "",
                    mySideexTabID: mySideexTabID
                }, {
                    frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
                })
            })
            .then(function(response) {
                if (domTime && (Date.now() - domTime) > 30000) {
                    sideex_log.error("DOM Wait timed out after 30000ms");
                    domCount = 0;
                    domTime = "";
                    commandType = "common";
                } else if (response && (Date.now() - response.dom_time) < 400) {
                    domCount++;
                    if (domCount == 1) {
                        domTime = Date.now();
                        sideex_log.info("Wait for the DOM tree modification");
                    }
                    commandType = "domWait";
                } else {
                    domCount = 0;
                    domTime = "";
                    commandType = "common";
                }
            })
            .then(executionLoop);
    } else if (commandType == "common") {
        console.log("in common");
        //xian wait
        commandType = "preparation";
        currentPlayingCommandIndex++;
        let commands = getRecordsArray();
        if (currentPlayingCommandIndex >= commands.length) {
            if (!caseFailed) {
                setColor(currentTestCaseId, "success");
                document.getElementById("result-runs").innerHTML = parseInt(document.getElementById("result-runs").innerHTML) + 1;
                declaredVars = {};
                sideex_log.info("Test case passed");
            } else {
                caseFailed = false;
            }
            return true;
        }

        let commandName = getCommandName(commands[currentPlayingCommandIndex]);
        let commandTarget = getCommandTarget(commands[currentPlayingCommandIndex]);
        let commandValue = getCommandValue(commands[currentPlayingCommandIndex]);

        if (implicitCount == 0) {
            sideex_log.info("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");
        }

        if (currentPlayingCommandIndex == 1) setColor(currentPlayingCommandIndex, "success");
        setColor(currentPlayingCommandIndex + 1, "executing");

        if (commandName == 'delay') {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    /* do nothing */
                    resolve();
                }, commandValue);
            }).then(executionLoop);
        } else if (commandName == 'open') {
            return browser.tabs.update(currentPlayingTabId, {
                    url: commandTarget
                })
                .then(executionLoop);
        } else if (commandName == 'selectFrame') {
            /* TODO: string error handling & wait for information been stored */
            let str = commandTarget.substr(commandTarget.lastIndexOf('=') + 1);
            if (str == "parent")
                currentPlayingFrameLocation.length = currentPlayingFrameLocation.lastIndexOf(':');
            else
                currentPlayingFrameLocation += ":" + str;
            console.log(currentPlayingFrameLocation);

            return new Promise(executionLoop);
            /*
            return new Promise(function(resolve, reject){
                        let count = 0;
                        let interval = setInterval( function(){
                            console.log("test")
                            if (count > 30) {
                                reject("Not Found");
                                clearInterval(interval);
                            }
                            if (!playingFrameLocations[currentPlayingTabId] ||
                                !playingFrameLocations[currentPlayingTabId][currentPlayingFrameLocation])
                                count++;
                            else {
                                resolve();
                                clearInterval(interval);
                            }
                        }, 100);
                }).then(executionLoop)
            */
        } else if (commandName == 'selectWindow') {
            currentPlayingFrameLocation = "root";
            if (playingTabNames[commandTarget]) {
                console.log("window has found, directly update");
                currentPlayingTabId = playingTabNames[commandTarget];
                //browser.windows.update(playingWindows[commandTarget].windowId, {focused: true});
                console.log("currentPlaying: " + currentPlayingTabId);
                console.log("currentPlaying: " + currentPlayingTabId);
                return browser.tabs.update(currentPlayingTabId, {
                        active: true
                    })
                    .then(executionLoop);
            } else if (newWindowInfo.tabId !== undefined && newWindowInfo.windowId !== undefined) {
                console.log("Found a new window, store the information and select to");
                playingTabNames[commandTarget] = newWindowInfo.tabId;
                newWindowInfo.tabId = undefined;
                newWindowInfo.windowId = undefined;
                currentPlayingTabId = playingTabNames[commandTarget];
                return browser.tabs.update(currentPlayingTabId, {
                        active: true
                    })
                    .then(executionLoop);
            } else {
                console.log("Error! Can't detect window");
                sideex_log.error("Can't detect window");
                //console.log("newWindowInfo.tabId: "+newWindowInfo.tabId);
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        if (newWindowInfo.tabId == undefined)
                            reject(new Error("Can't Find New Window"));
                        else
                            resolve();
                        currentPlayingCommandIndex--;
                    }, 5000);
                }).then(executionLoop);
            }
        } else if (commandName == 'close') {
            let removedTabId = currentPlayingTabId;
            currentPlayingTabId = -1;
            delete playingFrameLocations[removedTabId];
            //windowIdArray[removeInfo.windowId]=false;
            return browser.tabs.remove(removedTabId)
                .then(executionLoop);
        } else {
            /*
            return browser.tabs.query({windowId: currentPlayingWindowId, active: true })
                   .then( function(tabs){
                        return browser.tabs.sendMessage(tabs[0].id, { commands: commandName, target: commandTarget, value:commandValue },
                                    {frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]})})
                .then(executionLoop);
            */
            /*
            return browser.tabs.sendMessage(currentPlayingTabId, { commands: commandName, target: commandTarget, value:commandValue },
                            {frameId: playingFrameLocations[currentPlayingTabId][currentPlayingFrameLocation]})
                .then(executionLoop);
            */
            if (currentPlayingTabId === -1) {

                return browser.tabs.query({
                        windowId: userWinID,
                        active: true
                    })
                    .then(function(tabs) {
                        //commandReceiverTabId = tabs[0].id;
                        console.log("send: " + tabs[0].id);
                        return browser.tabs.sendMessage(tabs[0].id, {
                            commands: commandName,
                            target: commandTarget,
                            value: commandValue,
                            mySideexTabID: mySideexTabID
                        }, {
                            frameId: playingFrameLocations[tabs[0].id][currentPlayingFrameLocation]
                        })
                    })
                    .then(function(result) {
                        if (result.result != "success") {

                            // implicit
                            if (result.result.match(/Element[\s\S]*?not found/)) {
                                if (implicitTime && (Date.now() - implicitTime > 30000)) {
                                    sideex_log.error("Implicit Wait timed out after 30000ms");
                                    implicitCount = 0;
                                    implicitTime = "";
                                } else {
                                    implicitCount++;
                                    if (implicitCount == 1) {
                                        sideex_log.info("Wait until the element is found");
                                        implicitTime = Date.now();
                                    }
                                    currentPlayingCommandIndex--;
                                    commandType = "common";
                                    return true;
                                }
                            }

                            implicitCount = 0;
                            implicitTime = "";
                            sideex_log.error(result.result);
                            setColor(currentPlayingCommandIndex + 1, "fail");
                            setColor(currentTestCaseId, "fail");
                            document.getElementById("result-failures").innerHTML = parseInt(document.getElementById("result-failures").innerHTML) + 1;
                            if (commandName.includes("verify") && result.result.includes("did not match")) {
                                setColor(currentPlayingCommandIndex + 1, "fail");
                            } else {
                                sideex_log.info("Test case failed");
                                caseFailed = true;
                                currentPlayingCommandIndex = commands.length;
                            }
                        } else setColor(currentPlayingCommandIndex + 1, "success");
                    })
                    .then(executionLoop);
            } else {
                let p = new Promise(function(resolve, reject) {
                    let count = 0;
                    let interval = setInterval(function() {
                        if (count > 60) {
                            sideex_log.error("Timed out after 30000ms");
                            reject("Window not Found");
                            clearInterval(interval);
                        }
                        if (!playingFrameLocations[currentPlayingTabId]["status"]) {
                            if (count == 0) {
                                sideex_log.info("Wait for the new page to be fully loaded");
                            }
                            count++;
                        } else {
                            //console.log("status: "+playingFrameLocations[currentPlayingTabId]["status"]);
                            console.log("page load complete.");
                            resolve();
                            clearInterval(interval);
                        }
                    }, 500);
                });
                return p.then(function() {
                        return browser.tabs.sendMessage(currentPlayingTabId, {
                            commands: commandName,
                            target: commandTarget,
                            value: commandValue
                        }, {
                            frameId: playingFrameLocations[currentPlayingTabId][currentPlayingFrameLocation]
                        })
                    })
                    .then(function(result) {
                        if (result.result != "success") {

                            // implicit
                            if (result.result.match(/Element[\s\S]*?not found/)) {
                                if (implicitTime && (Date.now() - implicitTime > 30000)) {
                                    sideex_log.error("Implicit Wait timed out after 30000ms");
                                    implicitCount = 0;
                                    implicitTime = "";
                                } else {
                                    implicitCount++;
                                    if (implicitCount == 1) {
                                        sideex_log.info("Wait until the element is found");
                                        implicitTime = Date.now();
                                    }
                                    currentPlayingCommandIndex--;
                                    commandType = "common";
                                    return true;
                                }
                            }

                            implicitCount = 0;
                            implicitTime = "";
                            sideex_log.error(result.result);
                            setColor(currentPlayingCommandIndex + 1, "fail");
                            setColor(currentTestCaseId, "fail");
                            document.getElementById("result-failures").innerHTML = parseInt(document.getElementById("result-failures").innerHTML) + 1;
                            if (commandName.includes("verify") && result.result.includes("did not match")) {
                                setColor(currentPlayingCommandIndex + 1, "fail");
                            } else {
                                sideex_log.info("Test case failed");
                                caseFailed = true;
                                currentPlayingCommandIndex = commands.length;
                            }
                        } else {
                            setColor(currentPlayingCommandIndex + 1, "success");
                        }
                    })
                    .then(executionLoop);

            }
        }
    }
}

function finalizePlayingProgress() {
    enableClick();

    playingWindows = {};
    console.log("success");
    setTimeout(function() {
        isPlaying = false;
        isRecording = true;
    }, 500);
}

document.addEventListener("dblclick", function(event) {
    var temp = event.target;
    while (temp.tagName.toLowerCase() != "body") {
        if (/records-(\d)+/.test(temp.id)) {
            var index = temp.id.split("-")[1];
            executeCommand(index);
        }
        if (temp.id == "command-grid") {
            break;
        } else temp = temp.parentElement;
    }
});

function switchPR() {
    if (isPause) {
        document.getElementById("playback").disabled = true;
        document.getElementById("playSuite").disabled = true;
        document.getElementById("playSuites").disabled = true;
        document.getElementById("pause").style.display = "none";
        document.getElementById("resume").style.display = "";
    } else {
        document.getElementById("playback").disabled = false;
        document.getElementById("playSuite").disabled = false;
        document.getElementById("playSuites").disabled = false;
        document.getElementById("pause").style.display = "";
        document.getElementById("resume").style.display = "none";
    }
}

browser.runtime.onMessage.addListener(initialOpen);

function initialOpen(message) {
    if (message.passWinID) {
        console.log("passWinID:" + message.passWinID);
        userWinID = message.passWinID;
        windowIdArray[userWinID] = true;
    }
    if (message.sideexID) {
        console.log("mySideexTabID:" + message.sideexID);
        mySideexTabID = message.sideexID;
    }
}

function catchPlayingError(reason) {
    // doCommands is depend on test website, so if make a new page,
    // doCommands funciton will fail, so keep retrying to get connection
    if (reason == "TypeError: response is undefined" || reason == "Error: Could not establish connection. Receiving end does not exist.") {
        commandType = "preparation";
        setTimeout(function() {
            playAfterConnectionFailed();
        }, 100);
    } else {
        enableClick();

        console.log(reason);
        sideex_log.error(reason);

        if (currentPlayingCommandIndex == -1) {
            currentPlayingCommandIndex++;
        }
        setColor(currentPlayingCommandIndex + 1, "fail");
        setColor(currentTestCaseId, "fail");
        document.getElementById("result-failures").innerHTML = parseInt(document.getElementById("result-failures").innerHTML) + 1;
        sideex_log.info("Test case failed");

        /* Clear the flag, reset to recording phase */
        /* A small delay for preventing recording events triggered in playing phase*/
        setTimeout(function() {
            isPlaying = false;
            isRecording = true;
        }, 500);
    }
}

/*to handle new window pupup
  and update the windowIdArray from getting message
  if a new window is belong to this sideex,setting 
  its value become true. */
function handleNewWindow(message, sender, sendResponse) {
    if (message.newWindow) {

        console.error("new window ID: " + message.commandSideexTabID);
        if (message.commandSideexTabID != mySideexTabID) {
            windowCreateFlag = false;
            tabCreateFlag = false;
            return;
        }

        console.error("tab flag: " + tabCreateFlag + " window flag: " + windowCreateFlag);
        if (windowCreateFlag) {
            console.log("change window id");
            windowIdArray[sender.tab.windowId] = true;
            newWindowInfo.tabId = sender.tab.id;
            newWindowInfo.windowId = sender.tab.windowId;
            windowCreateFlag = false;
            tabCreateFlag = false;
        }

        if (tabCreateFlag && !windowCreateFlag) {
            newWindowInfo.tabId = tab.id;
            newWindowInfo.windowId = tab.windowId;
            tabCreateFlag = false;
        }
    }
};

browser.runtime.onMessage.addListener(handleNewWindow);

function handleChangePage(message, sender, response) {
    if (message.changePage) {
        console.log("page window ID:" + sender.tab.windowId);
        console.log("handle change page: " + windowIdArray[sender.tab.windowId]);
        if (windowIdArray[sender.tab.windowId] == true)
            response({
                mySideexTabID: mySideexTabID
            });
    }
}
browser.runtime.onMessage.addListener(handleChangePage);