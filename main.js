const crypto=require("crypto");
const fs = require("fs");
const keypair = require("keypair");

const sha256 = function(inp){
    return crypto.createHash("SHA256").update(inp).digest("hex");
};

const getPrivateAndPublicKey = function(){
    var kp = keypair();
    return [kp.private,kp.public];
};

const signData = function(privateKey,data){
    return crypto.createSign("RSA-SHA256").update(data).sign(privateKey,"base64");
}

const isValidateSignature = function(publicKey,data,signature){
    return crypto.createVerify("RSA-SHA256").update(data).verify(publicKey,signature,"base64");
};


class Transaction{
    constructor(transactionIndex,fromAddress,toAddress,amount,signature){
        this.fromAddress=fromAddress;
        this.toAddress=toAddress;
        this.amount=amount;
        this.transactionIndex=transactionIndex;
        if(signature)this.signature=signature;
    }
    get isValid(){
        return isValidateSignature(this.fromAddress,this.toStringWithoutSignature(),this.signature);
    }
    signTransaction(privateKey){
        this.signature = signData(privateKey,this.toStringWithoutSignature());
    }
    toStringWithoutSignature(){
        return JSON.stringify({"fromAddress":this.fromAddress,"amount":this.amount,"toAddress":this.toAddress,"transactionIndex":this.transactionIndex});
    }
    toString(){
        return JSON.stringify({"fromAddress":this.fromAddress,"amount":this.amount,"toAddress":this.toAddress,"transactionIndex":this.transactionIndex,"signature":this.signature});
    }
}

class Block{
    constructor(index,timestamp,transactions,previousHash,randomness,hash){
        this.index = index;
        this.timestamp=timestamp;
        this.transactions=transactions;
        this.previousHash=previousHash;
        this.randomness = randomness===undefined?0:randomness;
        hash?this.hash=hash:this.computeHash();
    }
    get getLiveHash(){
        return sha256(this.toStringWithoutHash());
    }
    computeHash(){
        this.hash = sha256(this.toStringWithoutHash());
        return this.hash;
    }
    toStringWithoutHash(){
        return JSON.stringify({"index":this.index,"timestamp":this.timestamp.toISOString(),"transactions":this.transactions.toString(),"previousHash":this.previousHash,"randomness":this.randomness});
    }
    toString(){
        return JSON.stringify({"index":this.index,"timestamp":this.timestamp.toISOString(),"transactions":this.transactions.toString(),"previousHash":this.previousHash,"randomness":this.randomness,"hash":this.hash});
    }
}

class Blockchain{
    constructor(difficulty,chaindata){
        this.difficulty=difficulty;

        //if(chaindata)
        this.chain = [this.getFirstBlock()];
        this.pendingTransactions = [];
    }
    getFirstBlock(){
        return new Block(0,new Date(),[],"(c) 2018 Marcel Aust");
    }
    get getLastTransactionIndex(){
        if(this.pendingTransactions.length>0){
            return this.pendingTransactions[this.pendingTransactions.length-1].transactionIndex;
        }
        else{
            for(var i=this.chain.length-1;i>=0;i--){
                if(this.chain[i].transactions.length!==0){
                    return this.chain[i].transactions[this.chain[i].transactions.length-1];
                }
            }
            return -1;
        }
    }
    addTransaction(transaction){
        //SHOULD CHECK FOR OWN WALLET HERE ^^
        if(transaction.transactionIndex===this.getLastTransactionIndex+1){
            if(transaction.isValid){
                this.pendingTransactions.push(transaction);
                return true;
            }
        }
        return false;
    }
    get getCurrentIndex(){
        return this.chain.length;
    }
    get getPreviousBlockHash(){
        return this.chain[this.chain.length-1].hash;
    }
    get getPendingTransactionSnapshot(){
        return this.pendingTransactions.slice();
    }
    addBlock(newBlock){
        if(newBlock.hash===newBlock.getLiveHash&&newBlock.hash.substr(0,this.difficulty)===(new Array(this.difficulty).join("0")+"0")){
            for(var i=0;i<newBlock.transactions.length;i++){
                this.pendingTransactions.find((d,x)=>{if(d.transactionIndex===newBlock.transactions[i].transactionIndex){this.pendingTransactions.splice(x);return true;}});
            }
            this.chain.push(newBlock);
            return true;
        }
    }
    validateChain(){
        for(var i=1;i<this.chain.length;i++){
            if(this.chain[i].hash!==this.chain[i].getLiveHash || this.chain[i].previousHash!==this.chain[i-1].hash){
                return false;
            }
        }
        return true;
    }

    getWalletValue(address){
        var m =0;
        for(var i=0;i<this.chain.length;i++){
            for(var j=0;j<this.chain[i].transactions.length;j++){
                if(this.chain[i].transactions[j].fromAddress===address){
                    m-=this.chain[i].transactions[j].amount;
                }
                if(this.chain[i].transactions[j].toAddress===address){
                    m+=this.chain[i].transactions[j].amount;
                }
            }
        }
        return m;
    }
}

const DIFF = 3;

var blockChain = new Blockchain(DIFF);

function mineBlock(){
    var block = new Block(blockChain.getCurrentIndex,new Date(),blockChain.getPendingTransactionSnapshot,blockChain.getPreviousBlockHash);
    var targetString = (new Array(DIFF)).join("0")+"0";
    console.log("COMPUTING BLOCK...");
    while(block.computeHash().substring(0,DIFF)!==targetString){
        block.randomness++;
    }
    block.hash;
    console.log("COMPUTED BLOCK..");
    if(blockChain.addBlock(block)){
        console.log("ADDED BLOCK!");
    }
    else{
        console.log("CANT ADD BLOCK");
    }
}

function newTransaction(f,t,a){
    var t = new Transaction(blockChain.getLastTransactionIndex+1,fs.readFileSync(f+"/public.pem").toString(),fs.readFileSync(t+"/public.pem").toString(),a);
    t.signTransaction(fs.readFileSync(f+"/private.pem"));
    blockChain.addTransaction(t);
    console.log("ADDED TRANSACTION...");
}

function getUserMoney(u){
    return blockChain.getWalletValue(fs.readFileSync(u+"/public.pem").toString());
}

newTransaction("me","bob",10);
mineBlock();
newTransaction("bob","anna",5);
newTransaction("anna","me",2.5);
mineBlock();
console.log("Is a valid chain?",blockChain.validateChain());

console.log("Bob:",getUserMoney("bob"));
console.log("Anna:",getUserMoney("anna"));
console.log("Me:",getUserMoney("me"));