/*
 *  These procedures use Agora Video Call SDK for Web to enable local and remote
 *  users to join and leave a Video Call channel managed by Agora Platform.
 */

/*
 *  Create an {@link https://docs.agora.io/en/Video/API%20Reference/web_ng/interfaces/iagorartcclient.html|AgoraRTCClient} instance.
 *
 * @param {string} mode - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#mode| streaming algorithm} used by Agora SDK.
 * @param  {string} codec - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#codec| client codec} used by the browser.
 */
var client;

/*
 * Clear the video and audio tracks used by `client` on initiation.
 */
var localTracks = {
    videoTrack: null,
    audioTrack: null
};

var localTrackState = {
    videoTrackMuted: false,
    audioTrackMuted: false
};

/*
 * On initiation no users are connected.
 */
var remoteUsers = {};

/*
 * On initiation. `client` is not attached to any project or channel for any specific user.
 */
let channelFinal = "";
if (channelId == null || channelId == undefined || channelId == "") {
    channelFinal = `${performance.now()}${Math.random().toString().slice(5)}`.replace('.', '');
} else {
    channelFinal = channelId;
}

var options = {
    appid: "0b7e91be4297490bb0346586e4f7cf4e",
    channel: channelFinal,
    uid: null,
    token: null
};

let statsInterval;
let lastMessageUserId = "";
let lastMessageId = "";

let chatsText = "";
let topicsText = "";
let questionsText = "";

let shareableLink = "";


AgoraRTC.onAutoplayFailed = () => {
    //alert("click to start autoplay!");
};
AgoraRTC.onMicrophoneChanged = async changedDevice => {
    // When plugging in a device, switch to a device that is newly plugged in.
    if (changedDevice.state === "ACTIVE") {
        localTracks.audioTrack.setDevice(changedDevice.device.deviceId);
        // Switch to an existing device when the current device is unplugged.
    } else if (changedDevice.device.label === localTracks.audioTrack.getTrackLabel()) {
        const oldMicrophones = await AgoraRTC.getMicrophones();
        oldMicrophones[0] && localTracks.audioTrack.setDevice(oldMicrophones[0].deviceId);
    }
};
AgoraRTC.onCameraChanged = async changedDevice => {
    // When plugging in a device, switch to a device that is newly plugged in.
    if (changedDevice.state === "ACTIVE") {
        localTracks.videoTrack.setDevice(changedDevice.device.deviceId);
        // Switch to an existing device when the current device is unplugged.
    } else if (changedDevice.device.label === localTracks.videoTrack.getTrackLabel()) {
        const oldCameras = await AgoraRTC.getCameras();
        oldCameras[0] && localTracks.videoTrack.setDevice(oldCameras[0].deviceId);
    }
};
async function switchCamera(label) {
    currentCam = cams.find(cam => cam.label === label);
    $(".cam-input").val(currentCam.label);
    // switch device of local video track.
    await localTracks.videoTrack.setDevice(currentCam.deviceId);
}
async function switchMicrophone(label) {
    currentMic = mics.find(mic => mic.label === label);
    $(".mic-input").val(currentMic.label);
    // switch device of local audio track.
    await localTracks.audioTrack.setDevice(currentMic.deviceId);
}

/*
 * When this page is called with parameters in the URL, this procedure
 * attempts to join a Video Call channel using those parameters.
 */

$(async() => {
    if (!client) {
        client = AgoraRTC.createClient({
            mode: "rtc",
            codec: getCodec()
        });
    }

    await join();
    //initializeSession();
});

/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
async function join() {
    // Add an event listener to play remote tracks when remote user publishes.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    // Join the channel.
    options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
    console.log(options.uid);
    if (!localTracks.audioTrack) {
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    }
    if (!localTracks.videoTrack) {
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: "720p_2"
        });
    }

    // Play the local video track to the local browser and update the UI with the user ID.
    localTracks.videoTrack.play("local-player");

    // Publish the local video and audio tracks to the channel.
    await client.publish(Object.values(localTracks));
    console.log("publish success");
    initStats();
    //initializeSession();
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
async function leave() {
    for (trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = undefined;
        }
    }

    destructStats();

    // Remove remote users and player views.
    remoteUsers = {};

    // leave the channel
    await client.leave();

    console.log("client leaves channel success");
    window.location = 'call-summary.html?channelId=' + options.channel + '&duration=' + $('#call-duration').text() + '&chats=' + chatsText + '&topics=' + topicsText + '&questions=' + questionsText;
}

/*
 * Add the local use to a remote channel.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
async function subscribe(user, mediaType) {
    const uid = user.uid;
    // subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("subscribe success");
    if (mediaType === "video") {
        user.videoTrack.play(`remote-user`);
    }
    if (mediaType === "audio") {
        user.audioTrack.play();
    }
}

/*
 * Add a user who has subscribed to the live channel to the local interface.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

/*
 * Remove the user specified from the channel in the local interface.
 *
 * @param  {string} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to remove.
 */
function handleUserUnpublished(user, mediaType) {
    if (mediaType === "video") {
        const id = user.uid;
        delete remoteUsers[id];
        //$(`#player-wrapper-${id}`).remove();
    }
}

function getCodec() {
    return "vp8";
}

// start collect and show stats information
function initStats() {
    statsInterval = setInterval(getCallDuration, 1000);
}

// stop collect and show stats information
function destructStats() {
    clearInterval(statsInterval);
}

// flush stats views
function getCallDuration() {
    // get the client stats message
    const clientStats = client.getRTCStats();
    let totalSeconds = clientStats.Duration;
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;

    $('#call-duration').text((hours > 9 ? hours : '0' + hours) + ":" + (minutes > 9 ? minutes : '0' + minutes) + ":" + (seconds > 9 ? seconds : '0' + seconds));
}

$("#mute-audio").click(function(e) {
    if (!localTrackState.audioTrackMuted) {
        muteAudio();
    } else {
        unmuteAudio();
    }
});
$("#mute-video").click(function(e) {
    if (!localTrackState.videoTrackMuted) {
        muteVideo();
    } else {
        unmuteVideo();
    }
});

$("#copy-id").click(function(e) {
    // Copy the text inside the text field
    navigator.clipboard.writeText(shareableLink);
    $('#copy-id').attr('data-original-title', 'Link Copied').tooltip('show');
});

$("#end-call").click(function(e) {
    leave();
});

async function muteAudio() {
    if (!localTracks.audioTrack) return;
    await localTracks.audioTrack.setMuted(true);
    localTrackState.audioTrackMuted = true;
    $('.fa-microphone').removeClass('fa-microphone').addClass('fa-microphone-slash');
    $('#mute-audio').attr('data-original-title', 'Unmute Audio').tooltip('show');
}
async function muteVideo() {
    if (!localTracks.videoTrack) return;
    await localTracks.videoTrack.setMuted(true);
    localTrackState.videoTrackMuted = true;
    $('.fa-video-camera').removeClass('fa-video-camera').addClass('fa-camera');
    $('#mute-video').attr('data-original-title', 'Disable Video').tooltip('show');
}
async function unmuteAudio() {
    if (!localTracks.audioTrack) return;
    await localTracks.audioTrack.setMuted(false);
    localTrackState.audioTrackMuted = false;
    $('.fa-microphone-slash').removeClass('fa-microphone-slash').addClass('fa-microphone');
    $('#mute-audio').attr('data-original-title', 'Mute Audio').tooltip('show');
}
async function unmuteVideo() {
    if (!localTracks.videoTrack) return;
    await localTracks.videoTrack.setMuted(false);
    localTrackState.videoTrackMuted = false;
    $('.fa-camera').removeClass('fa-camera').addClass('fa-video-camera');
    $('#mute-video').attr('data-original-title', 'Enable Video').tooltip('show');
}

///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////

/* SYMBL.AI For Live Captions */

function handleError(error) {
    if (error) {
        console.error(error);
    }
}

async function initializeSession() {
    const {
        Symbl,
        LINEAR16AudioStream
    } = window;

    try {

        // We recommend to remove appId and appSecret authentication for production applications.
        // See authentication section for more details
        const symbl = new Symbl({
            appId: appId,
            appSecret: appSecret,
            // accessToken: '<your Access Token>'
        });

        // Boilerplate code for creating a new AudioContext and MediaStreamAudioSourceNode
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
        });

        //const sampleRate = localTracks.audioTrack.getMediaStreamTrack().getSettings().sampleRate;
        const sampleRate = stream.getAudioTracks()[0].getSettings().sampleRate;
        const context = new AudioContext({ sampleRate });
        const sourceNode = context.createMediaStreamSource(stream);

        // Creating a new AudioStream
        const audioStream = new LINEAR16AudioStream(sourceNode);

        var connection = null;

        if (sessionId == null || sessionId == "" || sessionId == undefined) {
            // Open a Symbl Streaming API WebSocket Connection.
            connection = await symbl.createConnection();
        } else {
            // Subscribe Connection
            connection = await symbl.createConnection(sessionId);
        }

        var connectionOptions = {
            insightTypes: ["question", "action_item", "follow_up"],
            config: {
                encoding: "OPUS" // Encoding can be "LINEAR16" or "OPUS"
            },
            speaker: {
                userId: currentUser,
                name: userName
            }
        };

        // Start processing audio from your default input device.
        await connection.startProcessing(connectionOptions, audioStream);

        /*connection.on('follow_up', () => {
            console.log('I am connected!');
        })*/

        connection.on("conversation_created", (conversationData) => {
            // Handle conversationData here.
            console.log("Created!" + conversationData.data.conversationId);
            console.log("Created! " + connection.sessionId);
            shareableLink = "https://videocaptioner-agora.web.app?channel=" + options.channel + "&sessionId=" + connection.sessionId;
            $('#loadingBar').hide();
            $('#loadingBarText').hide();
        });

        // Retrieve real-time transcription from the conversation
        connection.on("speech_recognition", (speechData) => {
            $('#loadingBar').hide();
            $('#loadingBarText').hide();
            const {
                punctuated
            } = speechData;
            const name = speechData.user ? speechData.user.name : "User";
            console.log(`${name}: `, punctuated.transcript);
            if (speechData.user.userId != currentUser) {
                $('#caption').text(punctuated.transcript);
            }
        });

        // Retrieve real-time transcription from the conversation
        connection.on("message", (message) => {
            //console.log("Message: ", message[0]["payload"]["content"]);
            chatsText = chatsText + message[0].from.userId + ": " + message[0].payload.content + "\n";
            $('#notFoundChats').hide();
            if (message[0].from.userId == currentUser) {
                if (lastMessageUserId != "" && lastMessageUserId == currentUser) {
                    $("#" + lastMessageId).append('<div class="chat-bubble"> <div class="chat-content"> <p>' + message[0].payload.content + '</p> <span class="chat-time">' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric" }) + '</span> </div> </div>');
                } else {
                    lastMessageId = message[0].id;
                    $("#chats").append('<div class="chat chat-right"> <div class="chat-body" id="' + message[0].id + '"> <div class="chat-bubble"> <div class="chat-content"> <p>' + message[0].payload.content + '</p> <span class="chat-time">' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric" }) + '</span> </div> </div> </div> </div>');
                }
            } else {
                if (lastMessageUserId != "" && lastMessageUserId != currentUser) {
                    $("#" + lastMessageId).append('<div class="chat-bubble"> <div class="chat-content"> <p>' + message[0].payload.content + '</p> <span class="chat-time">' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric" }) + '</span> </div> </div>');
                } else {
                    lastMessageId = message[0].id;
                    $("#chats").append('<div class="chat chat-left"> <div class="chat-avatar"> <a class="avatar"> <img alt="' + message[0].from.userId + '" src="ic_avatar.jpg" class="img-fluid rounded-circle"> </a> </div> <div class="chat-body" id="' + message[0].id + '"> <div class="chat-bubble"> <div class="chat-content"> <p>' + message[0].payload.content + '</p> <span class="chat-time">' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric" }) + '</span> </div> </div> </div> </div>');
                }
            }
            lastMessageUserId = message[0].from.userId;

            chatWindow = document.getElementById('chatBody');
            var xH = chatWindow.scrollHeight;
            chatWindow.scrollTo(0, xH);
        });

        // Retrieve the topics of the conversation in real-time.
        connection.on("topic", (topicData) => {
            topicData.forEach((topic) => {
                //console.log("Topic: " + topic.phrases);
                topicsText = topicsText + topic.phrases + "\n";
                $('#notFoundTopics').hide();
                let colorArray = ['red', 'green', 'orange', 'blue', 'purple', 'pink'];
                let getRandomColor = colorArray[Math.floor(Math.random() * colorArray.length)];
                $('#topics').append('<span class="custom-badge status-' + getRandomColor + '">' + topic.phrases + '</span>');

                chatWindow = document.getElementById('chatBody');
                var xH = chatWindow.scrollHeight;
                chatWindow.scrollTo(0, xH);
            });
        });

        // Retrive questions from the conversation in real-time.
        connection.on("question", (questionData) => {
            //console.log("Question Found: ", questionData["payload"]["content"]);
            questionsText = questionsText + questionData["payload"]["content"] + "\n";
            $('#notFoundQuestions').hide();
            let colorArray = ['warning', 'primary', 'danger', 'success', 'info', 'dark'];
            let getRandomColor = colorArray[Math.floor(Math.random() * colorArray.length)];
            $('#questions').append('<div class="alert alert-' + getRandomColor + ' fade show" role="alert"> ' + questionData["payload"]["content"] + ' <i class="fa fa-question-circle fa-2x close"></i> </div>');

            chatWindow = document.getElementById('chatBody');
            var xH = chatWindow.scrollHeight;
            chatWindow.scrollTo(0, xH);
        });

    } catch (e) {
        // Handle errors here.
        console.log("Badka Error!" + e.message);
    }
}

// See the config.js file.
if (appId) {
    initializeSession();
}