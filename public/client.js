//2ND PLACE WINNER 2021 CONGRESSIONAL APP CHALLENGE - COLLABORATION CHAT APP 

//REQUIRED VARS
var socket = io();

//HTML ELEMENTS
var chatlog = document.getElementById('chat-area');
var session_info = document.getElementById('session-info');
var room_info = document.getElementById('roominfo');

//SERVER INFO
const IP = '127.0.0.1'; //LOCALHOST
const PORT = 8080;

document.addEventListener('keydown', check);

//PERFORMING FUNCTIONS WHEN RECEIVING MESSAGES FROM SERVER

//CHAT MESSAGE UPDATE
socket.on('message', function(room, msg) {
    if(room == user.room) {
        chatlog.innerHTML += '<br/>' + `[${update_dt()}] ${msg}`;
        update_scroll();
    }
});

//SERVER MESSAGE UPDATE 
socket.on('servermessage', function(msg) {
    chatlog.innerHTML += '<br/>' + `[${update_dt()}] ${msg}`;
    update_scroll();
});

//SENDS LOG OF ALL MESSAGES SENT TO CONSOLE
socket.on('messagelog', function(log) {
    console.log(log);
});

//SHOWS ALL ACTIVE USERS ON CHAT
socket.on('active', function(user_list) {
    console.log(user_list);
});

//SENDS SERVER INFO TO SESSION INFO FOR WHOLE SERVER
socket.on('serverinfo', function(info) {
    session_info.innerHTML += '<br/>' + `[${update_dt()}] ${info}`;
    update_info_scroll();
});

//SENDS ROOM INFO TO SESSION INFO FOR JUST ROOM INFO
socket.on('roominfo', function(room, info) {
    if(room == user.room) {
        session_info.innerHTML += '<br/>' + `[${update_dt()}] ${info}`;
        update_info_scroll();
        socket.emit('roomactive', user.room);
    }
});

//SENDS ANNOUNCEMENT TO CLIENT TO DISPLAY ON INFO + ALERT
socket.on('announcement', function(room, announcement) {
    if(room == user.room) {
        alert(announcement);
    }
});

//SENDS A LIST OF ALL ACTIVE USERS IN CLIENT'S SPECIFIC ROOM, UPDATES ACTIVE HEADER
socket.on('roomactive', function(log) {
    if (user.room != 'ALL') {
        console.log(log);
        room_info.innerHTML = `[ROOM] ${user.room} - [${log.length}] ACTIVE`;
    } else if (user.room == 'ALL') {
        room_info.innerHTML = `[ROOM] ${user.room}`;
    }
});

//SERVER ASSIGNS CLIENT AN ID
socket.on('id', function(id) {
    user.id = id;
});

//CLIENT RECEIVES A PRIVATE MESSAGE FROM THE SERVER -- REQUESTS THE PM TO BE DISPLAYED
socket.on('sendpm', function(id) {
    if(id == user.id) {
        socket.emit('receivepm');
    }
});

//WHEN CLIENT RECEIVES A LIST OF ALL CURRENT TAKEN USERNAMES, VERIFY USERNAME IS NOT TAKEN AND ASSIGN
socket.on('usernamelist', function(usernames) {
    taken_usernames = usernames;
    var username = prompt('Please input a username: ');
    if (username != '' && username != null) {
        if(check_availability(username) == true) {
            user.username = username;
            socket.emit('joined', user.username);
        } else {
            alert('That username is taken, sorry.');
            get_username();
        }
    } else {
        alert('Please enter a valid username.');
        get_username();
    }
});

//USER CLASS -- INCLUDES USER'S USERNAME, SERVER-ASSIGNED ID, AND CURRENT ROOM (EDITABLE WHEN JOINING/LEAVING ROOMS)
class User {
    constructor(username) {
        this.username = username;
        this.id;
        this.room = 'ALL';
    }
}

//MESSAGE CLASS -- INCLUDES MESSAGE CONTENT + CLIENT'S USERNAME -- USED TO SEND INFO TO SERVER TO DISPLAY ON OTHER CLIENTS DEVICES
class Message {
    constructor(plain_text, from_user) {
        this.content = plain_text;
        this.from = from_user;
    }
}

//CREATING NEW USER ON CONNECTION -- ASSIGNING USERNAME
function get_username() {
    socket.emit('usernamelist');
}

//CHECK TO SEE IF A USERNAME IS TAKEN
function check_availability(name) {
    for(i=0;i<taken_usernames.length;i++) {
        if(name == taken_usernames[i]) {
            return false;
        }
    }
    return true;
}

//WHEN "[SEND]" BUTTON OR "ENTER" IS PRESSED, EVALUATE IF IT IS A MESSAGE OR COMMAND, THEN ACT ACCORDINGLY
function send() {
    var text = document.getElementById('text-area').value;
    if (!text.startsWith('/')) {
        if(text != '') {
            var msg = new Message(text, user.username);
            socket.emit('message', user.room, `${msg.from}: ${msg.content}`);
            update_scroll();
        }
    } else {
        args = text.replace('/','');
        args = args.split(' ');

        //CYCLE THROUGH KNOWN COMMANDs
        switch(args[0]) {
            case "help":
                //LOG HELP TEXT AND ALERT USER WHEN CALLED
                console.log(help_text);
                alert(help_text);
                break;
            case "messagelog":
                //REQUEST A LIST OF ALL MESSAGES
                socket.emit('messagelog');
                break;
            case "active":
                //REQUEST A LIST OF ACTIVE USERS
                socket.emit('active');
                break;
            case "poll":
                poll_attributes = text.replace('/poll ', '');
                poll_attributes = poll_attributes.split(',');
                //REQUEST A POLL START
                socket.emit('poll', poll_attributes[0], poll_attributes[1], poll_attributes[2], poll_attributes[3]);
                break;
            case "vote":
                vote_attributes = text.replace('/vote ', '');
                vote_attributes = vote_attributes.split(' ');
                //REQUEST TO VOTE FOR A CERTAIN POLL vote_attributes[0] + VOTE FOR OPTION vote_attributes[1]
                socket.emit('vote', vote_attributes[0], vote_attributes[1]);
                break;
            case "link":
                link_attriubtes = text.replace('/link ', '');
                link_attriubtes = link_attriubtes.split(' ');
                //REQUEST TO POST A LINK
                socket.emit('link', user.username, user.room, link_attriubtes[0]);
                break;
            case "pm":
                pm_attributes = text.replace('/pm ', '');
                pm_attributes = pm_attributes.split(' ');
                pm_to = pm_attributes[0];
                pm_content = pm_attributes.slice(1).join(' ');
                //REQUEST TO SEND A PRIVATE MESSAGE TO pm_to CONTAINING pm_content
                socket.emit('pm', user.username, pm_to, pm_content);
                break;
            case "room":
                room_attributes = text.replace('/room ', '');
                room_attributes = room_attributes.toUpperCase();
                room_attributes = room_attributes.split(' ');
                var room_name = room_attributes[0];
                //JOIN A NEW ROOM -- REQUEST TO UPDATE USER'S SERVER-SIDE ROOM INFO
                socket.emit('joinroom', user.id, room_name);
                user.room = room_name;
                room_info.innerHTML = `[ROOM] ${room_name}`;
                break;
            case "roomactive":
                //REQUEST A LIST OF ALL USERS ACTIVE WITHIN THE USER'S ROOM
                socket.emit('roomactive', user.room);
            case "roomleave":
                //JOIN CERTAIN ROOM 'ALL' -- THE DEFAULT ROOM (LEAVE ROOM)
                socket.emit('joinroom', user.id, 'ALL');
                user.room = 'ALL';
                break;
            case "announce":
                announcement = text.replace('/announce ', '');
                //REQUEST TO SEND AN ANNOUNCEMENT TO ROOM user.room WITH CONTENT announcement
                socket.emit('announce', user.id, user.room, announcement);
                break;
        }
    }
    //CLEAR TEXT AREA AFTER send() HAS EXECUTED
    document.getElementById('text-area').value = '';
}

//CHECK TO SEE IF EVENT LISTENER PICKS UP "ENTER" BEING PRESSED, THEN SEND MESSAGE IF TRUE
function check(e) {
    if (e.keyCode == 13) {
        send();
    }
}

//WHEN CALLED, AUTOMATICALLY SCROLL FOR THE USER IN THE CHAT
function update_scroll() {
    area = document.getElementById('chat-area');
    area.scrollTop = area.scrollHeight;
}

//WHEN CALLED, AUTOMATICALLY SCROLL FOR THE USER IN THE SESSION INFO
function update_info_scroll() {
    area = document.getElementById('session-info');
    area.scrollTop = area.scrollHeight;
}

//CLEARS CHAT AREA WHEN CALLED THROUGH BUTTON "[CLEAR]" 
function clear_chat() {
    console.log('cleared chat');
    document.getElementById('chat-area').innerHTML = '';
}

//INTERMITTENTLY UPDATE THE LIST OF ACTIVE USERS AND ACTIVE HEADER SHOWING NUMBER OF USERS CONNECTED TO ROOM
setInterval(function() {
    socket.emit('roomactive', user.room);
}, 1000);

//MISC VARS
var user = new User();
var taken_usernames = [];

//USED WHEN COMMAND help IS CALLED
var help_text = 
'List of the commands:\n' + 
'/messagelog (get log of all previous messages)\n' + 
'/active (get a log of all users that have connected to the server)\n' +
'/poll QUESTION,OPTION1,OPTION2,TIME_IN_SECONDS (start a poll)\n' +
'/vote POLL<ID> OPTION (vote on a poll -- instructions provided when poll is created)\n' +
'/link LINK (send a link)\n'+
'/pm TO_USERNAME CONTENT (private message someone)\n' +
'/room ROOM (join room. if no room exists, create one)\n' +
'/roomactive (get a log of all users connected to your room)\n' +
'/roomleave (leave current room -- go to ALL room)\n' +
'/announce ANNOUNCEMENT (make an announcement)';

function update_dt() {
    var today = new Date();
    var noon = 'AM';
    var hours = today.getHours();
    var minutes = today.getMinutes();
    if (hours > 12) {
        noon = 'PM';
        hours -= 12;
    }
    if (hours == 12) {
        noon  = 'PM';
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    var dt = `${hours}:${minutes} ${noon}`;
    return dt;
}

window.onload = get_username();
