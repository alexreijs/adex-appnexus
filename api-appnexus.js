var fs = require('fs');
var http = require('http');
var util = require('util');
var readlineSync = require('readline-sync');
var tokenPath = './token-appnexus';
var auth = null;

exports.tokenValue = function (callBack) {
	if (exports.isValidFromDisk()) {
		callBack(fs.readFileSync(tokenPath, 'utf-8'));
	}
	else {
		//console.log('Getting token from API')
		exports.getTokenFromAPI(function(token) {
			callBack(token);
		});
	}
};
 
exports.isValidFromDisk = function() {
	if (fs.existsSync(tokenPath)) {
		stats = fs.statSync(tokenPath);
		mtime = new Date(util.inspect(stats.mtime));
		expiry = 3600 * 2 * 1000;
		if (Date.now() - mtime > expiry)
			return false;
		else
			return true;
	}
	else
		return false;
};

exports.getTokenFromAPI = function(callBack) {
	if (auth == null) {
		console.log('\nPlease provide your AppNexus credentials')
		auth = {"auth": {"username": readlineSync.question('Username: '), "password": readlineSync.question('Password: ', {hideEchoBack: true})}};
	}
	
	exports.appNexusRequest({'path': '/auth', 'method': 'POST'}, null, function (data) {
		jsonResponse = JSON.parse(data).response;
		if (jsonResponse.status == 'OK') {
			token = jsonResponse.token;
			fs.writeFileSync(tokenPath, token);
			callBack(token);
		}
		else {
			auth = null;
			callBack(false);
		}
	});
}

exports.appNexusRequest = function(options, token, callback) {
	defaults = {host: 'api.appnexus.com', 'port': 80, 'encoding': 'utf-8'};
	for (key in defaults) {
		if (typeof options[key] == 'undefined') {
			options[key] = defaults[key];
		}
	}
	
	if (options.path != '/auth')
		options.headers = {'Authorization': token}

	var req = http.request(options, function(res) {
		//console.log(Object.keys(res.req));
		var requestData = [];
				
		res.setEncoding(options.encoding);
		res.on('data', function(chunk) {
			requestData.push(chunk);
		});
		
		res.on('end', function () {
			callback(options.encoding == 'binary' ? Buffer.concat(requestData.map(function (o){ return new Buffer(o, 'binary')})) : requestData.join(''), res.headers);
		});
	});

	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
		callback(false);
	});
			
	if (options.path == '/auth' && auth !== null)
		req.write(JSON.stringify(auth));
	
	if (typeof options.data != 'undefined' && options.method == 'PUT')
		req.write(JSON.stringify(options.data));

	req.end();

}




exports.getServiceByName = function(serviceName, queryString, callback) {
	queryString = queryString || '';
	exports.tokenValue(function(token) {
		dataArray = [];
		getService = function(startElement) {
			path = '/' + serviceName + '?' + queryString + (queryString.length > 0 ? '&' : '') + 'start_element=' + startElement;
			exports.appNexusRequest({'path': path, 'method': 'GET'}, token, function (data) {
				response = JSON.parse(data).response;
				
				if (/change.log/g.test(serviceName))
					outputTerm = serviceName.replace(/\-/g, '_').toLowerCase() + 's';
				else 
					outputTerm = typeof response.dbg_info == 'undefined' ? serviceName + 's' : response.dbg_info.output_term;

				serviceResponse = response[outputTerm];
				
				//console.log('Getting ' + outputTerm + ': ' + Math.ceil(response.start_element / 100) + ' / ' +  Math.ceil(response.count / 100))
				
				if (typeof serviceResponse == 'object') {
					if (!Array.isArray(serviceResponse))
						serviceResponse = [serviceResponse];
					
					serviceResponse.forEach(function(o) {dataArray.push(o);})
					if (response.start_element + response.num_elements < response.count)
						getService(response.start_element + response.num_elements);
					else
						callback(dataArray);				
				}
				else {
					console.log('No valid response found for AppNexus service: ' + serviceName)
					callback(false)
				}
			});
		}
		getService(0);
	});	
}

