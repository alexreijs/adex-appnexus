var apiGoogle = require('./api-google.js');
var google = require('googleapis');


apiGoogle.getAccessToken(['https://www.googleapis.com/auth/adexchange.seller'], function (err) {
	if (err) {
		
		console.log('\nError verifying Google credentials, please try again');
		return;
	}

	options = {
		startDate: '2017-10-25',
		endDate: '2017-10-25',
		dimension: ['AD_TAG_CODE'],
		metric: ['EARNINGS']
	};
					
	adexchangeseller = google.adexchangeseller('v2.0');
	adexchangeseller.accounts.list({}, function (err, response) {
		if (err) {
			console.log('Error getting account ID: ' + err)
			return callback(err, []);
		}
		else {
			options.accountId = response.items[0].id;
			adexchangeseller.accounts.reports.generate(options, function (err, response) {
				if (err)
					console.log('error generating account report: ' + err)
				else {
					console.log(response);
				}
			})
		}
	})	
	
})