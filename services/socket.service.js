const logger = require('./logger.service')

var gIo = null

function setupSocketAPI(http) {
    gIo = require('socket.io')(http, {
        cors: {
            origin: '*',
        },
    })
    gIo.on('connection', socket => {
        logger.info(`New connected socket [id: ${socket.id}]`)
        socket.on('disconnect', socket => {
            logger.info(`Socket disconnected [id: ${socket.id}]`)
        })
        socket.on('set-wap-room', room => {
            console.log('room:', room)
            if (socket.myRoom === room) return
            if (socket.myRoom) {
                socket.leave(socket.myRoom)
                logger.info(`Socket is leaving room ${socket.myRoom} [id: ${socket.id}]`)
            }
            socket.join(room)
            socket.myRoom = room
        })
        socket.on('update-wap', wap => {
            // console.log('wap:', wap)
            broadcast({
                type: 'updated-wap',
                data: wap,
                room: socket.myRoom,
                userId: socket.id,
            })
        })
        socket.on('update-mouse-pos', mousePos => {
            broadcast({
                type: 'mouse-move',
                data: mousePos,
                room: socket.myRoom,
                userId: socket.id,
            })
        })
        socket.on('chat-send-msg', msg => {
            logger.info(`New chat msg from socket [id: ${socket.id}], emitting to room ${socket.myRoom}`)
            // emits to all sockets:
            // gIo.emit('chat addMsg', msg)
            // emits only to sockets in the same room
            gIo.to(socket.myRoom).emit('chat-add-msg', msg)
        })
        socket.on('user-watch', userId => {
            logger.info(`user-watch from socket [id: ${socket.id}], on user ${userId}`)
            socket.join('watching:' + userId)
        })
        socket.on('set-user-socket', userId => {
            logger.info(`Setting socket.userId = ${userId} for socket [id: ${socket.id}]`)
            socket.userId = userId
        })
        socket.on('unset-user-socket', () => {
            logger.info(`Removing socket.userId for socket [id: ${socket.id}]`)
            delete socket.userId
        })
        socket.on('send-lead', ({ room, wap, title, date, email, location, name, phone, schedule }) => {
            logger.info(`New lead from socket [id:${socket.id}]`)
            broadcast({
                type: 'add-lead',
                data: { wap, title, date, email, location, name, phone, schedule },
                room,
                userId: socket.id,
            })
        })

        socket.on('send-subscription', ({ room, wap, email, date }) => {
            logger.info(`New subscription from socket [id:${socket.id}]`)
            broadcast({
                type: 'add-subscription',
                data: { wap, email, date },
                room,
                userId: socket.id,
            })
        })

        socket.on('send-schedule', ({ room, wap, schedule }) => {
            logger.info(`New appointment from socket [id:${socket.id}]`)
            broadcast({
                type: 'add-schedule',
                data: { wap, schedule },
                room,
                userId: socket.id,
            })
        })

        socket.on('user-at-editor', wapId => {
            if (socket.currWap === wapId) return
            if (socket.currWap) {
                socket.leave(socket.wapId)
            }
            socket.join(wapId)
            socket.currWap = wapId
        })
    })
}

function emitTo({ type, data, label }) {
    if (label) gIo.to('watching:' + label.toString()).emit(type, data)
    else gIo.emit(type, data)
}

async function emitToUser({ type, data, userId }) {
    userId = userId.toString()
    const socket = await _getUserSocket(userId)

    if (socket) {
        logger.info(`Emiting event: ${type} to user: ${userId} socket [id: ${socket.id}]`)
        socket.emit(type, data)
    } else {
        logger.info(`No active socket for user: ${userId}`)
        // _printSockets()
    }
}

// If possible, send to all sockets BUT not the current socket
// Optionally, broadcast to a room / to all
async function broadcast({ type, data, room = null, userId }) {
    userId = userId.toString()
    logger.info(`Broadcasting event: ${type}`)
    // console.log('room:', room)
    const excludedSocket = await _getUserSocket(userId)
    // console.log(excludedSocket)
    if (room && excludedSocket) {
        console.log(':')
        logger.info(`Broadcast to room ${room} excluding user: ${userId}`)
        excludedSocket.broadcast.to(room).emit(type, data)
    } else if (excludedSocket) {
        logger.info(`Broadcast to all excluding user: ${userId}`)
        excludedSocket.broadcast.emit(type, data)
    } else if (room) {
        logger.info(`Emit to room: ${room}`)
        gIo.to(room).emit(type, data)
    } else {
        logger.info(`Emit to all`)
        gIo.emit(type, data)
    }
}

async function _getUserSocket(userId) {
    const sockets = await _getAllSockets()
    // console.log('sockets:', sockets)
    const socket = sockets.find(s => s.userId === userId)
    console.log('socket:', socket)
    return socket
}
async function _getAllSockets() {
    // return all Socket instances
    const sockets = await gIo.fetchSockets()
    return sockets
}

async function _printSockets() {
    const sockets = await _getAllSockets()
    console.log(`Sockets: (count: ${sockets.length}):`)
    sockets.forEach(_printSocket)
}
function _printSocket(socket) {
    console.log(`Socket - socketId: ${socket.id} userId: ${socket.userId}`)
}

module.exports = {
    // set up the sockets service and define the API
    setupSocketAPI,
    // emit to everyone / everyone in a specific room (label)
    emitTo,
    // emit to a specific user (if currently active in system)
    emitToUser,
    // Send to all sockets BUT not the current socket - if found
    // (otherwise broadcast to a room / to all)
    broadcast,
}
