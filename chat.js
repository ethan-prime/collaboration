


//REQUIRED VARS
const { throws } = require('assert');
const { time } = require('console');
var express = require('express');
const { SocketAddress } = require('net');
var app = express();
app.use(express.static('public'));
var http = require('http').Server(app);
var io = require('socket.io')(http);

//SERVER INFO -- PORT SET TO 8080
var port = process.env.PORT || 8080;

//SERVERSIDE VARIABLE LISTS CONTAINING INFO
var message_log = [];
var user_list = [];
var poll_list = [];
var pending_pms = [];

//WHEN THERE IS A NEW CONNECTION, HANDLE IT
io.on('connection', function(socket) {
    //LOG CONNECTION TO CONSOLE, SERVERSIDE
    console.log('[CONNECTION DETECTED]');

    //PROCESS MESSAGE SENT BY CLIENT, BROADCAST TO OTHER CLIENTS CONNECTED
    socket.on('message', function(room, msg) {
        console.log(`[MESSAGE TO ROOM ${room}]: ${msg}`);
        io.emit('message', room, `[${room}] ${msg}`);
        var logged = new Message(msg, msg.split(' ')[0].replace(':',''), room);
        message_log.push(logged);
    });

    //WHEN A USER JOINS, CREATE A NEW USER OBJECT AND APPEND TO LIST OF ALL CONNECTED USERS
    socket.on('joined', function(username) {
        var user = new User(username);
        user_list.push(user);
        io.emit('serverinfo', `${user.username} has joined the chat.`);
        socket.emit('id', user.id);
    });

    //PROCESS A USER JOINING A NEW ROOM, ASSIGN NEW ROOM VALUE
    socket.on('joinroom', function(id, room_name) {
        user_list[id].room = room_name;
        socket.emit('serverinfo', `YOU JOINED ROOM "${room_name}"`);
        io.emit('roominfo', room_name, `${user_list[id].username} has joined the room.`);
    });

    //SEND USER MESSAGE_LOG ARRAY WHEN REQUESTED
    socket.on('messagelog', () => {
        socket.emit('messagelog', message_log);
    });

    //SEND USER ACTIVE USER ARRAY WHEN REQUESTED
    socket.on('active', () => {
        socket.emit('active', user_list);
    });

    //PROCESS POLLS -- CREATE POLL, BROADCAST TO USERS, LISTEN FOR VOTES, AND SET TIME FOR POLL TO END
    socket.on('poll', function(q, o1, o2, time) {
        var poll = new Poll(q, o1, o2);
        poll_list.push(poll);
        var text = '<br>' + `[SERVER POLL] ${poll.q}` + '<br>' + `[OPTION 1] ${o1}` + '<br>' + `\n[OPTION 2] ${o2}` + '<br>' +`[---] Use /vote POLL${poll.id} [YOUR OPTION HERE (1,2)] to vote.` +'<br>' + `[---] Poll ends in ${time} seconds.` + '<br>';
        io.emit('servermessage', text);
        io.emit('serverinfo', `A poll was created.`);
        setTimeout(function() {
            if(parseInt(poll.o1votes) > parseInt(poll.o2votes)) {
                io.emit('servermessage',`<br>[OPTION 1] wins with [${poll.o1votes}] votes.<br>`);
            }
            else if(parseInt(poll.o2votes) > parseInt(poll.o1votes)) {
                io.emit('servermessage', `<br>[OPTION 2] wins with [${poll.o2votes}] votes.<br>`);
            }
            else if(parseInt(poll.o2votes) == parseInt(poll.o1votes)) {
                io.emit('servermessage', `<br>[-----] It was a tie.<br>`);
            }
            io.emit('serverinfo', `A poll ended.`);
        }, time*1000);
    });

    //WHEN A VOTE IS RECEIVED, EDIT VOTE ATTRIBUTE OF POLL
    socket.on('vote', function(poll_id, option) {
        var poll_id = poll_id.replace('POLL', '');
        var poll_id = parseInt(poll_id);
        socket.emit('serverinfo', `[POLL${poll_id}] You voted for option ${option}.`);
        if(option == '1') {
            poll_list[poll_id].o1votes += 1;
        } 
        else if(option == '2') {
            poll_list[poll_id].o2votes += 1;
        }
    });

    //PROCESS LINK COMMAND, EMIT CLICKABLE LINK IN SESSION INFO SECTION TO USERS IN SPECIFIC ROOM
    socket.on('link', function(from, room, link) {
        var text = `${from} sent a link: <a href=${link} target="_blank">[CLICK TO VIEW]</a>`;
        io.emit('roominfo', room, text);
    });

    //PROCESS PMS
    socket.on('pm', function(pm_from, pm_to, pm_text) {
        var pm = new PM(pm_from, pm_to, pm_text);
        pending_pms.push(pm);
        for(i=0; i<user_list.length; i++) {
            if (user_list[i].username == pm_to) {
                io.emit('sendpm', user_list[i].id);
                break;
            }
        }
    });

    //^^^ WHEN INTENDED CLIENT REQUESTS A PM, SEND IT TO THEM
    socket.on('receivepm', function() {
        socket.emit('servermessage', `[PM from ${pending_pms[0].from}] ${pending_pms[0].content}`);
        pending_pms = [];
    });

    //SEND ARRAY OF ALL ACTIVE USERS WITHIN CLIENT'S ROOM WHEN REQUESTED
    socket.on('roomactive', function(room_name) {
        var room_active = [];
        for(i=0;i<user_list.length;i++) {
            if(user_list[i].room == room_name) {
                room_active.push(user_list[i]);
            }
        }
        socket.emit('roomactive', room_active);
    });

    //PROCESS ANNOUNCE COMMAND, SEND ANNOUNCEMENT TO SESSION INFO SECTION TO ALL CLIENTS AND ALSO ALERT() THEM
    socket.on('announce', function(id, room, announcement) {
        if (room != 'ALL') {
            io.emit('roominfo', room, `[ANNOUNCEMENT] ${user_list[id].username}: ${announcement}`);
            io.emit('announcement', room, `[ANNOUNCEMENT] ${user_list[id].username}: ${announcement}`);
        }
    });

    socket.on('usernamelist', function() {
        var usernames = [];
        for(i=0;i<user_list.length;i++) {
            usernames.push(user_list[i].username);
        }
        socket.emit('usernamelist', usernames);
    });

});

//SERVING HTML FILE TO SERVER
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/chat.html');
});

//START SERVER ON PORT port
http.listen(port, function() {
    console.log(`Listening on port ${port}.`);
});

//FUNCTION THAT INDEXES MESSAGES SENT
var message_num = -1;
function message_index() {
    message_num += 1;
    return message_num;
}

//FUNCTION THAT INDEXES USERS WHEN SERVER REQUESTS, CREATES USER IDS
var user_index = -1;
function gen_user_id() {
    user_index += 1;
    return user_index;
}

//FUNCTION THAT INDEXES POLLS WHEN CREATED
var poll_index = -1;
function gen_poll_id() {
    poll_index += 1;
    return poll_index;
}

//MESSAGE OBJECT, CONSITS OF ATTRIBUTES TEXT, USER THAT SENT IT, TIME, AUTO GENERATED MESSAGE ID, AND TOO WHICH ROOM THE MESSAGE WAS SENT
class Message {
    constructor(text, from_user, room) {
        this.text = text;
        this.from = from_user;
        this.time = update_dt();
        this.id = message_index();
        this.room = room;
    }
}

//USER OBJECT, CONSISTS OF A USERNAME, ROOM, AND AUTO GENERATED ID
class User {
    constructor(username, room) {
        this.username = username;
        this.room = 'ALL';
        this.id = gen_user_id();
    }
}

//POLL OBJECT, CONSISTS OF QUESTION, BOTH OPTIONS, ALL VOTES, AND AUTO GENERATED POLL ID
class Poll {
    constructor(q, o1, o2) {
        this.q = q;
        this.o1 = o1;
        this.o2 = o2;
        this.id = gen_poll_id();
        this.o1votes = 0;
        this.o2votes = 0;
    }
}

//PM OBJECT, CONSISTS OF USER WHO SENT IT, INTENDED RECEIPIENT, AND CONTENT OF THE MESSAGE
class PM {
    constructor(from, to, content) {
        this.from = from;
        this.to = to;
        this.content = content;
    }
}

//FUNCTION THAT MANAGES DATE + TIME FOR DISPLAYING WITH MESSAGES, RETURNS HH:MM AM/PM
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

//INTERMITTENTLY SEND OUT TIPS TO USERS ON HOW TO USE THE CHAT
setInterval(function() {
    var tip = tips[Math.floor(Math.random(1)*tips.length)];
    io.emit('serverinfo', `[SERVER] ${tip}`);
}, 60000);

//MISC VARS
var tips = ['Use /help for info on how to use commands.', 'Use /room ROOM_ID to join/create a room.', 'Use /pm USERNAME MESSAGE to privately message another user connected to the server.', 'Use /link LINK to send clickable links.']