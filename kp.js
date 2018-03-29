const keypair = require("keypair");
const fs = require("fs");

var kp = keypair();

fs.mkdirSync("anna");
fs.writeFileSync("anna/private.pem",kp.private);
fs.writeFileSync("anna/public.pem",kp.public);