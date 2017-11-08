var apiAppNexus = require('./api-appnexus.js');
var firstBy = require('thenby');


testMode = true;
nameString = 'HeaderBidding - Algemeen - ';

if (testMode) {
	options = {
		ioId: 451622,
		advertiserId: 1516466
	}	
	
	creatives = {
		'320x100': {id: 64006150},
		'728x90': {id: 64006463},
		'160x600': {id: 73915936},
		'120x600': {id: 66326046},
		'300x250': {id: 64134234},
		'336x280': {id: 65698000},
		'320x240': {id: 65024940},
		'300x600': {id: 62778732},
		'970x250': {id: 64006150},
		'320x500': {id: 64006150},
		'1800x1000': {id: 64006150},
		'120x90': {id: 64006150},
		'1800x200': {id: 64006150},
		'970x1000': {id: 64006150},
		'970x500': {id: 64006150}
	}
}
else {
	options = {
		ioId: 645306,
		advertiserId: 2156035
	}
	
	creatives = {
		'320x100': {id: 81105163},
		'728x90': {id: 81105409},
		'160x600': {id: 81105543},
		'120x600': {id: 81105544},
		'300x250': {id: 81105709},
		'336x280': {id: 81105710},
		'320x240': {id: 81106025},
		'300x600': {id: 81106026},
		'970x250': {id: 81106205},
		'320x500': {id: 81106206},
		'1800x1000': {id: 81106344},
		'120x90': {id: 81106345},
		'1800x200': {id: 81106347},
		'970x1000': {id: 81106348},
		'970x500': {id: 81106350}
	}	
}

groups = [
	{cents: 1, start: 0.5, end: 1, formats: ['320x100']},
	{cents: 1, start: 1, end: 3, formats: ['320x100', '728x90', '160x600', '120x600']},
	{cents: 1, start: 3, end: 6, formats: ['320x100', '728x90', '160x600', '120x600', '300x250', '336x280', '320x240']},
	{cents: 1, start: 6, end: 10, formats: ['320x100', '728x90', '160x600', '120x600', '300x250', '336x280', '320x240', '300x600', '970x250', '320x500']},
	{cents: 1, start: 10, end: 20, formats: ['320x100', '728x90', '160x600', '120x600', '300x250', '336x280', '320x240', '300x600', '970x250', '320x500', '1800x1000', '120x90', '1800x200', '970x1000', '970x500']},
	{cents: 10, start: 20, end: 30, formats: ['320x100', '728x90', '160x600', '120x600', '300x250', '336x280', '320x240', '300x600', '970x250', '320x500', '1800x1000', '120x90', '1800x200', '970x1000', '970x500']},
	{start: 30, formats: ['320x100', '728x90', '160x600', '120x600', '300x250', '336x280', '320x240', '300x600', '970x250', '320x500', '1800x1000', '120x90', '1800x200', '970x1000', '970x500']}
];

items = groups.sort(firstBy('start').thenBy('end')).map(function(group) {
	splits = [];
	
	if (group.cents || 0 > 0 && group.end || 0 > 0) {
		for (x = group.start; x < group.end; x += (group.cents / 100)) {
			lower = x.toFixed(2);
			upper = (x + (group.cents > 1 ? (group.cents - 1) / 100 : 0)).toFixed(2);
			splits.push(lower == upper ? lower : lower + '-' + upper)
		}
	}
	else
		splits.push(group.start.toFixed(2))

	return {
		formats: group.formats,
		splits: splits
	};
}).reduce(function(acc, item) {
	item.splits.forEach(function(split) {
		acc.push({
			name: nameString + split,
			split: split,
			formats: item.formats
		})
	})
	return acc;
}, [])







apiAppNexus.tokenValue(function(token) {
	if (token == false) {
		console.log('\nError verifying AppNexus credentials, please try again');
		return;
	}
	else {
		try {		
			apiAppNexus.getServiceByName('line-item', '&fields=id,name,advertiser_id,creatives&like_name=' + encodeURIComponent(nameString), function(existingLineItems) {
				if (existingLineItems === false) {
					console.log('Failed to receive AppNexus LineItems report')
					return;
				}

				existingLineItemNames = existingLineItems.map(function(lineItem) {
					return lineItem.name;
				});
				
				items = items.slice(700, 800);
				items = items.filter(function(lineItem, index) {
					return existingLineItemNames.indexOf(lineItem.name) == -1;
				}).filter(function(lineItem, index) {
					return index < 10;
					//return true;
				});
						
				console.log('Received AppNexus LineItems report');
				if (items.length == 0) {
					console.log('It seems that every line item you want to add already exists in AppNexus')
					return;
				}
				apiAppNexus.appNexusRequest({
					'path': '/profile?advertiser_id=' + options.advertiserId,
					'method': 'POST',
					'data': {
						'profiles': items.map(function(lineItem, index) {	
							return {
								'allow_unaudited': true,
								'key_value_targets': {
									'kv_expression': {
										'header': {
											'an_version': '1.0',
											'client_version': '1.0'
										},
										'exp': {
											'typ': 'in',
											'vtp': 'sta',
											'key': 'hb_pb',
											'vsa': [lineItem.split]
										}
									}
								}
							}
						})
					}
				}, token, function (responseData) {
					response = JSON.parse(responseData).response;
					if (response.status == 'OK') {
						if (response.count == 1)
							newProfiles = [response['profile']];
						else {
							newProfiles = Object.keys(response['profiles']).map(function(id) {
								return response['profiles'][id];
							});
						}
						
						newProfilesById = newProfiles.reduce(function(acc, profile) {
							acc[profile.key_value_targets.kv_expression.exp.vsa[0]] = profile;
							return acc;
						}, {})
																	
						console.log('Successfully created ' + newProfiles.length + ' profile' + (newProfiles.length > 1 ? 's' : ''));	
						apiAppNexus.appNexusRequest({
							'path': '/line-item?advertiser_id=' + options.advertiserId,
							'method': 'POST',
							'data': {
								'line-items': items.map(function(lineItem, index) {	
									return {
										'name': lineItem.name,
										'manage_creative': true,
										'state': 'active',
										'revenue_type': 'cpm',
										'revenue_value': +lineItem.split,
										'profile_id': newProfilesById[lineItem.split].id,
										'creatives': lineItem.formats.map(function(format) {
											return {id: creatives[format].id};
										}),
										'insertion_orders': [
											{id: options.ioId}
										]
									}
								})
							}
						}, token, function (responseData) {
							response = JSON.parse(responseData).response;
							if (response.status == 'OK') {
								if (response.count == 1)
									newLineItems = [response['line-item']];
								else {
									newLineItems = Object.keys(response['line-items']).map(function(id) {
										return response['line-items'][id];
									});
								}
																	
								console.log('Successfully created ' + newLineItems.length + ' line-item' + (newLineItems.length > 1 ? 's' : ''));
								apiAppNexus.appNexusRequest({
									'path': '/campaign?advertiser_id=' + options.advertiserId,
									'method': 'POST',
									'data': {
										'campaigns': newLineItems.map(function(newLineItem) {
											return {
												'name': newLineItem.name,
												'state': 'active',
												'inventory_type': 'direct',
												'line_item_id': newLineItem.id,
												'priority': 5
											}
										})
									}
								}, token, function (responseData) {
									response = JSON.parse(responseData).response;
									if (response.status == 'OK') {
										if (response.count == 1)
											newCampaigns = [response['campaign']];
										else {
											newCampaigns = Object.keys(response['campaigns']).map(function(id) {
												return response['campaigns'][id];
											});
										}											
										console.log('Successfully created ' + newCampaigns.length + ' campaign' + (newCampaigns.length > 1 ? 's' : ''));
									}
									else {
										console.log('Failed to create campaigns')
										throw new Error(response.error || 'Unknown error');
									}
								})
							}
							else {
								console.log('Failed to create line-items')
								throw new Error(response.error || 'Unknown error');
							}
						})					
					}
					else {
						console.log('Failed to create profiles')
						throw new Error(response.error || 'Unknown error');
					}
				})
			})
		}			
		catch(err) {
			console.log('Failed to run script: ' + err.message)
		}
	}
})














		

// Change logs

/*
apiAppNexus.appNexusRequest({
	'path': '/change-log?service=line-item&resource_id=4833120'
}, token, function (responseData) {
	JSON.parse(responseData).response['change_logs'].forEach(function(change) {
		apiAppNexus.appNexusRequest({
			'path': '/change-log-detail?service=line-item&resource_id=4833120&transaction_id=' + change.transaction_id
		}, token, function (responseData) {
		console.log('\n\n==========================================\n\n')

			JSON.parse(responseData).response['change_log_details'].forEach(function(details) {
				details.changes.filter(function(change) {
					return true//change.changed;
				}).forEach(function(change) {
					console.log(change);
				})
			})
		})				
	})
})


apiAppNexus.appNexusRequest({
	'path': '/change-log?service=profile&resource_id=94991232'
}, token, function (responseData) {
	JSON.parse(responseData).response['change_logs'].forEach(function(change) {
		apiAppNexus.appNexusRequest({
			'path': '/change-log-detail?service=profile&resource_id=94991232&transaction_id=' + change.transaction_id
		}, token, function (responseData) {
		console.log('\n\n==========================================\n\n')

			JSON.parse(responseData).response['change_log_details'].forEach(function(details) {
				details.changes.filter(function(change) {
					return change.changed;
				}).forEach(function(change) {
					console.log(change);
				})
			})
		})				
	})
})
*/