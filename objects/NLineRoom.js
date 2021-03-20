
module.exports = class NLineRoom{

    constructor(size,winSize, playerInfo, socketPlayer1, code, privateRoom,deleter){
        this.board = this.createBoard(size);
        this.code = code;
        this.winSize = winSize;
        this.player1 = {
            info: playerInfo,
            socket:socketPlayer1
        }
        this.player2 = {
            info:null,
            socket:null
        }
        this.player1Playing = true;
        this.privateRoom = privateRoom;
        this.active = true;
        this.deleter = deleter;
    }

    disconnectionhandler (isPlayer1) {
        this.active = false;
        this.deleter(this);
        const controller = require('../controllers').PlayerController;
        // se guarda en al base de datos
        controller.addGame({
            player1:this.player1.info.id,
            player2:this.player2.info.id,
            player_winner:isPlayer1?this.player2.info.id:this.player1.info.id
        })
        this.player1.socket.emit("finishGameRoom",{win:0,playerWinner:isPlayer1?this.player2.info.id:this.player1.info.id}); // 0 : desconectado
        this.player2.socket.emit("finishGameRoom",{win:0,playerWinner:isPlayer1?this.player2.info.id:this.player1.info.id}); // 0 : desconectado
        // se envia la informacion de perdidad al jugador desconectado

        // se cierra la conexion
        //console.log(this.player1.socket);
        this.player1.socket.disconnect(true);
        this.player2.socket.disconnect(true);
    }

    moveHandler(data,sendTo){
        if(this.verifyMove(data.x,data.y)){
            //El movimiento es valido

            this.board[data.x][data.y].id = data.id;
            
            if(this.verifyWin(data.id)){
                //Gano el Jugador que movio
                this.finishGame(1,data.id);
                return;
            }
            if(!this.verifyBoard()){
                //tablero lleno
                this.finishGame(2,0);
                return;
            }
            // se envia la informacion al jugador
            sendTo.emit('responseBoard', data)
        }
    }

    finishGame(win,playerWinner){
        this.player1.socket.emit("finishGameRoom",{ win:win, board:this.board, playerWinner: playerWinner });
        this.player2.socket.emit("finishGameRoom",{ win:win, board:this.board, playerWinner: playerWinner });
        this.active = false;
        this.deleter(this);
        const controller = require('../controllers').PlayerController;
        // se guarda en al base de datos
        controller.addGame({
            player1:this.player1.info.id,
            player2:this.player2.info.id,
            player_winner: playerWinner
        })
        this.player1.socket.disconnect(true);
        this.player2.socket.disconnect(true);
    }

    /**
     * Verifica si el tablero esa lleno
     * @returns 
     */
    verifyBoard(){
        for(let col = 0; col < this.board.length ; col ++){
            if(this.board[0][col].id == 0)
                return true;
        }
        return false;
    }

    verifyMove(x,y){
        return this.board[x][y].id == 0? true:false;
    }

    markGroup(initialX,initialY,substractionX,substractionY){
        for(let i = 0; i < this.winSize;i++){
            this.board[initialX][initialY].mark = true;
            initialX = initialX + substractionX;
            initialY = initialY + substractionY;
        }
    }

    verifyWin(id){
        for( let r = 0; r < this.board.length; r++){
            for( let c = 0; c < this.board.length; c++){

                if(this.board[r][c].id != id)
                    continue
                
                if(c+this.winSize <= this.board.length){
                    if(this.verifyRight(r,c,id)){
                        this.markGroup(r,c,0,1);
                        return true;
                    }
                }
                if(r+this.winSize <= this.board.length){
                    if(this.verifyBottom(r,c,id)){
                        this.markGroup(r,c,1,0);
                        return true;
                    }
                    if(c+this.winSize <= this.board.length)
                        if(this.verifyBotomRight(r,c,id)){
                            this.markGroup(r,c,1,1);
                            return true;
                        }
                    if(c-this.winSize >= 0)
                        if(this.verifyBottomLeft(r,c,id)){
                            this.markGroup(r,c,1,-1);
                            return true;
                        }
                }
            }
        }
        return false;
    }

    verifyBottomLeft(x,y,id){
        for(let i = this.winSize; i > 0; i--){
            if(this.board[x+i][y-i].id != id){
                return false;
            }
        }
        return true;
    }

    verifyBotomRight(x,y,id){
        for(let i = 0; i < this.winSize; i++){
            if(this.board[x+i][y+i].id != id){
                return false;
            }
        }
        return true;
    }

    verifyBottom(x,y,id){
        for(let i = 0; i < this.winSize; i++){
            if(this.board[x+i][y].id != id){
                return false;
            }
        }
        return true;
    }

    verifyRight(x,y,id){
        for(let i = 0; i < this.winSize; i++){
            if(this.board[x][y+i].id != id){
                return false;
            }
        }
        return true;
    }

    start(){
        this.player1.socket.emit('gameRoomInfo',{ board: this.board, isPlaying:this.player1Playing, player: this.player2.info});
        this.player2.socket.emit('gameRoomInfo',{ board: this.board, isPlaying:!this.player1Playing, player: this.player1.info });

        this.player1.socket.on('disconnect', () => {
            if(this.active)
                this.disconnectionhandler(true)
        });

        this.player2.socket.on('disconnect', () => {
            if(this.active)
                this.disconnectionhandler(false)
        });


        this.player1.socket.on('boardMove', (data) => {
            if(this.player1Playing){
                this.player1Playing = false;
                this.moveHandler(data,this.player2.socket);
            }
        });
        this.player2.socket.on('boardMove', (data) =>{
            if(!this.player1Playing){
                this.player1Playing = true;
                this.moveHandler(data,this.player1.socket);
            }
        });
    }

    cronometro(jugador){
        const modulo = require('proyecto-2c-crono');
        const cont = new modulo.Descontador(15);
        var d = cont.start().subscribe(
            data =>  {
                if (data === 'FINISH') {
                    d.unsubscribe();
                    if(jugador === true){
                        this.player1.socket.disconnect(true);
                    }else if(jugador === false){
                        this.player2.socket.disconnect(true);
                    }
                }
            }
        );
    }

    createBoard(size) {
        let board = [];
        for (let x = 0; x < size; x++) {
            let subCol = [];
            for (let y = 0; y < size; y++) {
                subCol.push({
                    id: 0,
                    x: x,
                    y: y,
                    ghost:false,
                    mark:false
                });
            }
            board.push(subCol);
        } 
        return board;
    }
}
