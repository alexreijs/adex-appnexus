var fs = require('fs');

var apiGoogle = require('./api-google.js');
var apiAppNexus = require('./api-appnexus.js');

var sqlite3 = require('sqlite3');//.verbose();
var db = new sqlite3.Database('database.sqlite');

db.run('\
	create table if not exists ad_tag_reports (\
		ad_tag_id INT,\
		timestamp INT,\
		rpm FLOAT\
	)\
')


/*
if (fs.existsSync('./token-appnexus'))
	fs.unlinkSync('./token-appnexus')

if (fs.existsSync('./token-google'))
	fs.unlinkSync('./token-google')
*/


function startProcess() {
	console.log('\n' + new Date(Date.now()) + ' - running sript');

	apiAppNexus.tokenValue(function(token) {
		if (token == false) {
			console.log('\nError verifying AppNexus credentials, please try again');
			startProcess();
			return;
		}
			
		apiGoogle.getAccessToken(['https://www.googleapis.com/auth/adexchange.seller'], function (err) {
			if (err) {
				console.log('\nError verifying Google credentials, please try again');
				startProcess();
			}
			
			options = {
				startDate: 'today',
				endDate: 'today',
				dimension: ['AD_TAG_CODE'],
				metric: ['AD_IMPRESSIONS_RPM']
			};
				
			console.log('\nAppNexus and Google credentials verified and access tokens have been saved to disk\n');
				
			fields = options.dimension.concat(options.metric);		
			apiGoogle.getRPMPerAdTag(options, function(err, rpmPerAdTag) {
				if (err) {
					console.log('Error getting RPM per AdTag: ' + err)
					process.exit(0);
				}
								
				console.log('Received Google AdExchange AdTags report')
				
				apiAppNexus.getServiceByName('line-item', '&fields=id,name,advertiser_id&like_name=(gadx|', function(data) {
					console.log('Received AppNexus LineItems report')
					
					//console.log(data);
					
					appNexusLineItems = data.map(function(row) {
						matches = row.name.match(/\(gadx\|([0-9]*)\)/) || [];
						if (matches.length > 0)
							row.adExId = matches[1];
						return row;
					}).filter(function(row) {
						return typeof row.adExId != 'undefined';
					}).reduce(function(acc, row) {
						acc[row.adExId] = row;
						return acc;
					}, {})
								
					bridgedItems = rpmPerAdTag.filter(function(row) {
						return typeof appNexusLineItems[row[fields.indexOf('AD_TAG_CODE')]] != 'undefined'
					}).map(function(row) {
						adExAdTagId = row[fields.indexOf('AD_TAG_CODE')];
						lineItem = appNexusLineItems[adExAdTagId];
						lineItem.adExAdTagId = adExAdTagId;
						lineItem.adExRPM = row[fields.indexOf('AD_IMPRESSIONS_RPM')]
						return lineItem;
					})
									
					stmt = db.prepare("insert into ad_tag_reports (ad_tag_id, timestamp, rpm) values (?, ?, ?)");		
					db.parallelize(function() {
						bridgedItems.forEach(function(lineItem) {
							stmt.run([lineItem.adExAdTagId, +Date.now(), lineItem.adExRPM]);
						})
					})
					stmt.finalize();
	
					bridgedItems.forEach(function(_lineItem, index) {
						setTimeout(function(lineItem) {
							apiAppNexus.appNexusRequest({
								'path': '/line-item?id=' + lineItem.id + '&advertiser_id=' + lineItem.advertiser_id,
								'data': {
									"line-item": {
										"revenue_value": lineItem.adExRPM
									}
								},
								'method': 'PUT'
							}, token, function (data) {
								try {
									response = JSON.parse(data);
									if (response.response.status == 'OK')
										console.log('Updated AppNexus LineItem (' + lineItem.id + ') - RPM: ' + lineItem.adExRPM)
									else
										throw new Error(response.response.error || 'Unknown error');
								}
								catch(err) {
									console.log('Failed to update AppNexus LineItem (' + lineItem.id + ') - Error: ' + err);
								}
							})
						}, index * 1500, _lineItem);
					})
				});
			});
		});
	});
}

console.log('Welcome! This script will update AppNexus line items based on Google AdExchange data')
startProcess();
setInterval(startProcess, 10 * 60 * 1000);