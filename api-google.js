var readlineSync = require('readline-sync');
var opn = require('opn');
var fs = require('fs');
var google = require('googleapis')
var tokenFile = './token-google';

var OAuth2Client = google.auth.OAuth2;

var googleClient = require('./auth-google.js');
var oauth2Client = new OAuth2Client(googleClient.CLIENT_ID, googleClient.CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');

function getAccessToken(scopes, callback) {

	if (fs.existsSync(tokenFile)) {
		try {
			tokenFromDisk = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
			oauth2Client.setCredentials(tokenFromDisk);
			google.options({auth: oauth2Client});

			oauth2Client.refreshAccessToken(function(err, tokens) {
				fs.writeFileSync(tokenFile, JSON.stringify(tokens), 'utf-8');
				oauth2Client.setCredentials(tokens);
				google.options({auth: oauth2Client});
			});
			
			return callback(null);
		}
		catch(e) {
			return callback(e);
		}
	}
	
	var url = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: scopes
	});

	opn(url);	
	console.log('\nA browser page should be openened for you in order to verify your Google credentials. If this doesn\'t happen, please visit this URL:\n' + url + '\n');
	oauth2Client.getToken(readlineSync.question('Enter the code from the page: '), function (err, tokens) {
		if (err)
			return callback(err);
		
		fs.writeFileSync(tokenFile, JSON.stringify(tokens), 'utf-8');
		oauth2Client.setCredentials(tokens);
		google.options({auth: oauth2Client});
		return callback(null);
	});

}


function getRPMPerAdTag(options, callback) {
	options = options || {};
	adexchangeseller = google.adexchangeseller('v2.0');
	adexchangeseller.accounts.list({}, function (err, response) {
		if (err) {
			console.log('Error getting account ID: ' + err)
			return callback(err, []);
		}
		else {
			options.accountId = response.items[0].id;
			adexchangeseller.accounts.reports.generate(options, function (err, response) {
				if (err) {
					console.log('error generating account report: ' + err)
					return callback(err, []);
				}
				else {
					return callback(null, response.rows || []);
				}
			})
		}
	})	
}



module.exports = {
	getAccessToken: getAccessToken,
	getRPMPerAdTag: getRPMPerAdTag
}