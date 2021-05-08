const NLineRoom = require('../objects/index').NLineRoom;

var gameRooms   = [];
var cont        = 0;

/**
 *  se encarga de crear instnacias de juegos privadas
 * @param {*} socket socket del servidor 
 * @param {*} client socket del cliente
 */
exports.createGameRoom = (socket,client) => {
    client.on("createGameRoom", (data)=>{
        cont++;
        var code = Math.random().toString(36).substring(7).concat(cont);
        var gameRoom = new NLineRoom(data.boardSize, 4, data.playerInfo, client, code, true, deleteGameRoom, data.bot, data.nivel,data.roomId);
        gameRooms.push(gameRoom);
        client.emit('createdGameRoom', code);
        if(data.bot){
            gameRoom.start();
        }
    });
}

function deleteGameRoom (object) {
    let index = gameRooms.indexOf(object);
    gameRooms.splice(index,1);
}


/**
 *  Se encarga de conectar con una instancia de juego en epecifico
 * @param {*} socket socket del servidor 
 * @param {*} client socket del cliente
 */
exports.connectGameRoom = (socket,client) => {
    client.on("connectGameRoom", (data)=>{
        for( var i = 0; i < gameRooms.length; i++ ){
            var room = gameRooms[i];
            if(room.code == data.code){
                console.log(data.playerInfo)
                room.player2 = {
                    info:data.playerInfo,
                    socket:client
                }
                client.emit('connectedGameRoom',true);
                room.start();
                return;
            }
        }
        client.emit('connectedGameRoom',false)
    });
}

/**
 * Esta funcion se encarga de buscar una instancia de juego a la cual conectar. en caso de que no exista una 
 * se crea una instancia y espera la conexion de otro jugador. 
 * @param {*} socket socket del servidor 
 * @param {*} client socket del cliente
 */
exports.searchGame = (socket,client) => {
    client.on("searchGame", (data)=>{

        for( var i = 0; i < gameRooms.length; i++){
            var room = gameRooms[i];
            if(data.roomId){
                if(room.roomId == data.roomId){
                    room.player2 = {
                        info:data.playerInfo,
                        socket:client
                    }
                    client.emit('searchedGame',{searching:false,});
                    room.start();
                    return;
                }
                else
                    continue;
            }
            if(!room.privateRoom && data.boardSize == room.board.length && room.roomId == null){
                room.player2 = {
                    info:data.playerInfo,
                    socket:client
                }
                client.emit('searchedGame',{searching:false});
                room.start();
                return;
            }
        }

        cont++;
        var gameRoom = new NLineRoom(data.boardSize,4, data.playerInfo, client,'',false,deleteGameRoom,false,0,data.roomId);
        gameRooms.push(gameRoom);
        client.emit('searchedGame', {searching:true});
    });
}

var rooms = [];

exports.joinRoom = (socket,client) => {
    client.on("joinRoom", (data)=>{

        var room = null;
        data.user.socket = client;
        for(let i = 0; i < rooms.length; i++){
            if(rooms[i].idRoom == data.idRoom){
                var exist = false;
                for(let i = 0; i < rooms[i].user.length; i++){
                    if(rooms[i].user[i].id == data.user.id){
                        exist = true;
                        break
                    }
                }
                
                if(!exist)
                    rooms[i].user.push(data.user);
                room = rooms[i];
                break
            }
        }
        if(!room){
            room = {idRoom:data.idRoom,user:[data.user]};
            rooms.push(room);
        }

        client.join(data.idRoom);

        //le envio al conectado los que estan en la sala conectados;
        var users = [];
        for(let i = 0; i < room.user.length; i ++){
            const user = room.user[i]
            users.push({
                id:user.id,
                username:user.username,
                picture:user.picture
            })
        }
        client.emit('roomInfo',users);

        //enviar la informacion del conectado a todos
        socket.in(data.idRoom).emit('userConnected',{
            username: data.user.username,
            id: data.user.id,
            picture: data.user.picture,
        });
    });
}


exports.exitRoom = (socket,client) => {
    client.on("exitRoom", (data)=>{
        client.leave(data.idRoom);
        socket.in(data.idRoom).emit('userDisconnected',data.user);
    });
}


exports.exitRoom = (socket,client) => {
    client.on(" ", (data)=>{
        client.leave(data.idRoom);
        socket.in(data.idRoom).emit('userDisconnected',data.user);
    });
}


module.exports