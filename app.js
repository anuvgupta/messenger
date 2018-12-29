const port = 3000;

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const alpha = require('is-alphanumeric');


var app = express();
var server = http.Server(app);
io = socketio(server);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/static/index.html');
});

app.use(express.static('static'));

var chats = {
    'public': [],
    'private': {}
};
var users = { };
var online = { };

io.on('connection', function (socket) {
    console.log('user ' + socket.id + ' connected');
    users[socket.id] = {
        'id': socket.id,
        'socket': socket,
        'name': null
    };
    socket.on('disconnect', function () {
        console.log('user ' + socket.id + ' disconnected');
        delete users[socket.id];
        delete online[socket.id];
        io.emit('update online', JSON.stringify(online));
    });
    socket.on('new user', function (name) {
        if (alpha(name)) {
            console.log('user ' + socket.id + ' is ' + name);
            users[socket.id]['name'] = name;
            online[socket.id] = name;
            io.emit('update online', JSON.stringify(online));
            socket.emit('welcome');
        } else socket.emit('invalid');
    });
    socket.on('open main', function () {
        console.log('user ' + socket.id + ' requests history for chat "main"');
        socket.emit('chat history', 'main', [], JSON.stringify(chats.public));
    });
    socket.on('open direct', function (users) {
        var chat = users.sort().join('_');
        console.log('user ' + socket.id + ' opening DM: ' + chat);
        if (!chats.private.hasOwnProperty(chat)) {
            chats.private[chat] = {
                members: users,
                log: []
            };
        }
        socket.emit('chat history', chat, chats.private[chat].members, JSON.stringify(chats.private[chat].log));
    });
    socket.on('chat message', function (chat, msg) {
        if (msg.trim() != '') {
            var name = users[socket.id].name;
            var time = parseInt(Date.now() / 1000);
            console.log("message in chat \"" + chat + "\" – " + name + "[" + socket.id + "]" + ": " + msg);
            if (chat == 'main') {
                chats.public.push([socket.id, name, msg, time]);
                io.emit('chat message', chat, socket.id, name, msg, time);
            } else {
                var priv_chat = chats.private[chat];
                priv_chat.log.push([socket.id, name, msg, time]);
                var members = chats.private[chat].members;
                for (var m in members) {
                    io.to(members[m]).emit('chat message', chat, socket.id, name, msg, time);
                }
            }
        }
    });
});

server.listen(port, function () {
    console.log('listening on *:' + port);
});
