var nodemailer = require("nodemailer");

module.exports = function(config) {
  this.config = config;

  this.send = function(message) {
    var smtpTransport = nodemailer.createTransport(config.email.transports[config.email.transport]);
    smtpTransport.sendMail({
        from: config.email.from,
        to: config.email.to,
        subject: message.subject,
        text: message.text
    }, function(err, res){
        if(err) console.log((new Date()).toString() + " :: Error sending deployment email:: " + err);
        else console.log((new Date()).toString() + " :: Successfully sent deployment email.");
    });
  };
  this.verify = function() {
      var transporter = nodemailer.createTransport(config.email.transports[config.email.transport]);
      transporter.verify(function (error, success) {
          if (error) {
            console.log(error);
          } else {
            console.log("Mail Server is ready to take our messages");
          }
        });
  };
}